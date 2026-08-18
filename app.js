const menuPresets = {
  premium: {
    title: "Degustacion premium",
    price: 43000,
    sweetTablePrice: 3000,
    items: [
      "Recepcion fria con mesa de fiambres, quesos, matambre, salamines, dips y pan casero.",
      "Sanguchitos premium frios: matambrito, provoleta, crudo y queso a las hierbas.",
      "Recepcion caliente con empanadas premium o mini canastitas bandejeadas.",
      "Mini burger casera, pollo crispy con provoleta y bondiola BBQ.",
      "Show de pizzetas fin de fiesta."
    ]
  },
  pernil: {
    title: "Picada y pernil con dulce",
    price: 39300,
    sweetTablePrice: 0,
    items: [
      "Recepcion fria con mesa de fiambres, quesos, matambre, salamines, dips y pan casero.",
      "Sanguchitos premium frios en mesa.",
      "Recepcion caliente con empanadas premium o mini canastitas.",
      "Pernil de cerdo con panes y salsas: BBQ, mostaza y miel, alioli, criolla y cebollas caramelizadas."
    ]
  },
  custom: {
    title: "Menu personalizado",
    price: 0,
    sweetTablePrice: 0,
    items: [
      "Menu a definir segun platos elegidos, disponibilidad y modalidad del evento."
    ]
  }
};

const fields = [
  "clientName",
  "clientPhone",
  "eventDate",
  "eventTime",
  "eventType",
  "serviceDuration",
  "venue",
  "kitchenAvailable",
  "eventZone",
  "adults",
  "children",
  "quotePremium",
  "quotePernil",
  "quoteCustom",
  "sweetTable",
  "staff",
  "foodTruck",
  "invoice",
  "vegetarian",
  "celiac",
  "kidsMenu",
  "notes",
  "pricePerPerson",
  "sweetTablePrice",
  "staffUnitPrice",
  "staffPrice",
  "foodTruckPrice",
  "otherExtras",
  "depositPercent",
  "taxPercent",
  "internalNotes"
];

const state = {
  activeId: null,
  draftId: null,
  saved: loadSavedQuotes()
};

const moneyFormatter = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  maximumFractionDigits: 0
});

const numberFormatter = new Intl.NumberFormat("es-AR", {
  maximumFractionDigits: 1
});

const form = document.querySelector("#quoteForm");
const savedList = document.querySelector("#savedList");
const savedCount = document.querySelector("#savedCount");
const quotePreview = document.querySelector("#quotePreview");
const messagePreview = document.querySelector("#messagePreview");
const copyStatus = document.querySelector("#copyStatus");
const quoteCode = document.querySelector("#quoteCode");
const statusPill = document.querySelector("#statusPill");
const introScreen = document.querySelector("#introScreen");
const introVideo = document.querySelector("#introVideo");
const authStatus = document.querySelector("#authStatus");
const authFields = document.querySelector("#authFields");
const authEmail = document.querySelector("#authEmail");
const authPassword = document.querySelector("#authPassword");
const loginButton = document.querySelector("#loginButton");
const logoutButton = document.querySelector("#logoutButton");
const workspace = document.querySelector(".workspace");
const topbarActions = document.querySelector(".topbar-actions");
const publicSubmitButton = document.querySelector("#publicSubmitButton");
const publicSubmitStatus = document.querySelector("#publicSubmitStatus");

const firebaseState = {
  enabled: false,
  user: null,
  auth: null,
  db: null
};

function element(id) {
  return document.getElementById(id);
}

function getSelectedMenuKey() {
  return quoteMenuKeys(readMenuChecks())[0] || "premium";
}

function readMenuChecks() {
  return {
    quotePremium: element("quotePremium")?.checked ?? true,
    quotePernil: element("quotePernil")?.checked ?? false,
    quoteCustom: element("quoteCustom")?.checked ?? false
  };
}

function readForm() {
  const data = {};
  fields.forEach((field) => {
    const input = element(field);
    data[field] = input.type === "checkbox" ? input.checked : input.value;
  });
  data.menuPreset = getSelectedMenuKey();
  data.id = state.activeId || state.draftId || createQuoteId();
  state.draftId = data.id;
  data.updatedAt = new Date().toISOString();
  return data;
}

function writeForm(data) {
  fields.forEach((field) => {
    const input = element(field);
    if (!input || data[field] === undefined) return;
    if (input.type === "checkbox") {
      input.checked = Boolean(data[field]);
    } else {
      input.value = data[field];
    }
  });

  element("quotePremium").checked = data.quotePremium !== false && !data.quotePernil && !data.quoteCustom ? true : Boolean(data.quotePremium);
  element("quotePernil").checked = Boolean(data.quotePernil);
  element("quoteCustom").checked = Boolean(data.quoteCustom);
  if (!hasCheckedMenu(readMenuChecks())) {
    element("quotePremium").checked = true;
  }
  state.activeId = data.id || null;
  state.draftId = data.id || null;
  updatePresetPrice(false);
  render();
}

function createQuoteId() {
  const now = new Date();
  const datePart = [
    String(now.getFullYear()).slice(-2),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0")
  ].join("");
  const randomPart = String(Math.floor(Math.random() * 900) + 100);
  return `${datePart}${randomPart}`;
}

function toNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function calculate(data) {
  const menu = menuPresets[quoteMenuKeys(data)[0]] || menuPresets.custom;
  return calculateWithPrices(data, toNumber(data.pricePerPerson) || menu.price, toNumber(data.sweetTablePrice));
}

function calculateForMenu(data, menuKey) {
  const menu = menuPresets[menuKey] || menuPresets.custom;
  if (menuKey === "custom") {
    return calculateWithPrices(data, toNumber(data.pricePerPerson), toNumber(data.sweetTablePrice));
  }
  return calculateWithPrices(data, menu.price, menu.sweetTablePrice);
}

function calculateWithPrices(data, pricePerPerson, sweetTablePrice) {
  const adults = Math.max(0, toNumber(data.adults));
  const children = Math.max(0, toNumber(data.children));
  const effectiveGuests = adults + children * 0.5;
  const food = effectiveGuests * Math.max(0, toNumber(pricePerPerson));
  const sweet = data.sweetTable ? effectiveGuests * Math.max(0, toNumber(sweetTablePrice)) : 0;
  const staffCount = Math.max(1, Math.ceil((adults + children) / 20));
  const suggestedStaff = staffCount * Math.max(0, toNumber(data.staffUnitPrice));
  const staff = data.staff ? Math.max(0, toNumber(data.staffPrice) || suggestedStaff) : 0;
  const truck = data.foodTruck ? Math.max(0, toNumber(data.foodTruckPrice)) : 0;
  const extras = Math.max(0, toNumber(data.otherExtras));
  const grandTotal = food + sweet + staff + truck + extras;
  const adultPrice = adults > 0 ? grandTotal / adults : 0;
  const depositAmount = grandTotal * (Math.max(0, toNumber(data.depositPercent)) / 100);
  const taxedTotal = data.invoice
    ? grandTotal * (1 + Math.max(0, toNumber(data.taxPercent)) / 100)
    : grandTotal;

  return {
    adults,
    children,
    effectiveGuests,
    staffCount,
    suggestedStaff,
    food,
    sweet,
    staff,
    truck,
    extras,
    grandTotal,
    adultPrice,
    depositAmount,
    taxedTotal
  };
}

function quoteMenuKeys(data) {
  const keys = [];
  if (data.quotePremium) keys.push("premium");
  if (data.quotePernil) keys.push("pernil");
  if (data.quoteCustom) keys.push("custom");
  return keys.length ? keys : ["premium"];
}

function hasCheckedMenu(data) {
  return Boolean(data.quotePremium || data.quotePernil || data.quoteCustom);
}

function formatMoney(value) {
  return moneyFormatter.format(Math.round(value || 0));
}

function formatDate(value) {
  if (!value) return "A definir";
  const date = new Date(`${value}T12:00:00`);
  return date.toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "long",
    year: "numeric"
  });
}

function selectedConditions(data) {
  const items = [];
  if (data.vegetarian) items.push("Adaptacion vegetariana");
  if (data.celiac) items.push("Opciones celiacas / sin TACC");
  if (data.kidsMenu) items.push("Menu infantil a consultar");
  if (data.invoice) items.push("Solicita factura");
  return items;
}

function buildPreview(data, totals) {
  const optionKeys = quoteMenuKeys(data);
  const menu = menuPresets[optionKeys[0]] || menuPresets.custom;
  const hasMultipleMenus = optionKeys.length > 1;
  const conditions = selectedConditions(data);
  const extras = [];

  if (data.sweetTable && !hasMultipleMenus) extras.push(`Mesa dulce degustacion en shot: ${formatMoney(totals.sweet)}`);
  if (data.staff) extras.push(`Personal de salon y cocina: ${totals.staffCount} personas, ${data.serviceDuration || "5 hs"}: ${formatMoney(totals.staff)}`);
  if (data.foodTruck) extras.push(`Food truck / cocina movil: ${formatMoney(totals.truck)}`);
  if (data.invoice) extras.push(`Factura: total con IVA ${formatMoney(totals.taxedTotal)}`);
  if (totals.extras > 0) extras.push(`Otros extras: ${formatMoney(totals.extras)}`);

  return `
    <div class="preview-document">
      <div class="preview-brand">
        <img src="assets/bondi-brand-logo.png" alt="La Cocina del Bondi">
        <div>
          <strong>#RUTAALPALADAR</strong>
          <span>221 525-2925</span>
          <span>@Ezecocina</span>
          <span>ezecocina84@hotmail.com</span>
        </div>
      </div>
      <div class="preview-head">
        <div>
          <h3>${hasMultipleMenus ? "Opciones de catering" : "Presupuesto de catering"}</h3>
          <p>${hasMultipleMenus ? "Presupuestos solicitados" : escapeHtml(menu.title)} para ${numberFormatter.format(totals.adults)} adultos${totals.children ? ` y ${numberFormatter.format(totals.children)} menores de 2 a 8 años` : ""}.</p>
        </div>
        <div class="preview-meta">
          <strong>Nro. ${escapeHtml(data.id)}</strong>
          <span>${formatDate(data.eventDate)}</span>
          <span>${escapeHtml(data.eventTime || "A definir")}</span>
        </div>
      </div>

      <section class="preview-section">
        <h4>Cliente y evento</h4>
        <p><strong>${escapeHtml(data.clientName || "Cliente a definir")}</strong> - ${escapeHtml(data.clientPhone || "WhatsApp a definir")}</p>
        <p>${escapeHtml(data.eventType || "Evento a definir")} - ${escapeHtml(data.serviceDuration || "5 hs")}</p>
        <p>Lugar: ${escapeHtml(data.venue || "A definir")} - Zona: ${escapeHtml(data.eventZone || "A definir")}</p>
        <p>Cocina disponible: ${escapeHtml(data.kitchenAvailable || "A confirmar")}</p>
        <p>Invitados equivalentes para calculo: ${numberFormatter.format(totals.effectiveGuests)}</p>
      </section>

      <section class="preview-section">
        <h4>${hasMultipleMenus ? "Opciones para elegir" : "Menu incluido"}</h4>
        <div class="menu-options">
          ${optionKeys.map((key) => buildMenuOption(data, key)).join("")}
        </div>
      </section>

      <section class="preview-section">
        <h4>Extras y condiciones</h4>
        <ul class="preview-list">
          ${extras.length ? extras.map((item) => `<li>${escapeHtml(item)}</li>`).join("") : "<li>Sin extras cargados.</li>"}
          ${conditions.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}
        </ul>
      </section>

      ${data.notes ? `
      <section class="preview-section">
        <h4>Observaciones</h4>
        <p>${escapeHtml(data.notes).replace(/\n/g, "<br>")}</p>
      </section>` : ""}

      <div class="preview-total">
        <div>
          <span>${hasMultipleMenus ? "Primera opcion" : "Total estimado"}</span>
          <strong>${formatMoney(totals.grandTotal)}</strong>
        </div>
        <div>
          <span>${data.invoice ? "Total con factura" : "Precio por adulto"}</span>
          <strong>${data.invoice ? formatMoney(totals.taxedTotal) : formatMoney(totals.adultPrice)}</strong>
        </div>
      </div>
      <div class="preview-footer">
        <div>
          <strong>Terminos y condiciones</strong>
          <span>Forma de pago: 50% anticipo - 50% hasta 72 hs antes.</span>
          <span>Los precios incluyen bondi show a domicilio y personal de cocina.</span>
          <span>Mantenimiento de oferta sujeto a fecha del presupuesto.</span>
        </div>
      </div>
    </div>
  `;
}

function buildMenuOption(data, menuKey) {
  const menu = menuPresets[menuKey] || menuPresets.custom;
  const totals = calculateForMenu(data, menuKey);
  const selected = quoteMenuKeys(data)[0] === menuKey;

  return `
    <article class="menu-option ${selected ? "is-selected" : ""}">
      <div class="menu-option-head">
        <div>
          <strong>${escapeHtml(menu.title)}</strong>
          ${selected ? "<span>Opcion marcada</span>" : ""}
        </div>
        <strong>${formatMoney(totals.grandTotal)}</strong>
      </div>
      <ul class="preview-list">
        ${menu.items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}
        ${data.sweetTable ? `<li>Mesa dulce: ${formatMoney(totals.sweet)}</li>` : ""}
      </ul>
      <div class="menu-option-total">
        <span>Valor por adulto: ${formatMoney(totals.adultPrice)}</span>
        <span>Sena sugerida: ${formatMoney(totals.depositAmount)}</span>
        ${data.invoice ? `<span>Con factura: ${formatMoney(totals.taxedTotal)}</span>` : ""}
      </div>
    </article>
  `;
}

function buildMessage(data, totals) {
  const optionKeys = quoteMenuKeys(data);
  const menu = menuPresets[optionKeys[0]] || menuPresets.custom;
  const hasMultipleMenus = optionKeys.length > 1;
  const conditions = selectedConditions(data);
  const lines = [
    `Hola ${data.clientName || ""}, te paso la propuesta para tu evento:`,
    "",
    `Fecha del evento: ${formatDate(data.eventDate)} (${data.eventTime || "A definir"})`,
    `Tipo de evento: ${data.eventType || "A definir"}`,
    `Lugar: ${data.venue || "A definir"} - Zona: ${data.eventZone || "A definir"}`,
    `Cocina disponible: ${data.kitchenAvailable || "A confirmar"}`,
    `Invitados: ${numberFormatter.format(totals.adults)} adultos${totals.children ? ` + ${numberFormatter.format(totals.children)} menores de 2 a 8 años` : ""}`,
    hasMultipleMenus ? `Menus cotizados: ${optionKeys.map((key) => menuPresets[key].title).join(" / ")}` : `Menu: ${menu.title}`,
    `Servicio: ${data.serviceDuration || "5 hs"}${data.staff ? ` con ${totals.staffCount} personas de salon/cocina` : ""}`,
    "",
    ...buildMessageTotals(data, totals),
    ""
  ];

  if (conditions.length) {
    lines.push(`Incluye consideraciones: ${conditions.join(", ")}.`);
  }

  if (data.invoice && !hasMultipleMenus) {
    lines.push(`Con factura: ${formatMoney(totals.taxedTotal)} final con IVA.`);
  }

  lines.push("Quedo atento para ajustar cualquier detalle y confirmar disponibilidad.");
  return lines.join("\n");
}

function buildMessageTotals(data, totals) {
  const optionKeys = quoteMenuKeys(data);
  if (optionKeys.length === 1) {
    return [
      `Total estimado: ${formatMoney(totals.grandTotal)}`,
      `Valor por adulto: ${formatMoney(totals.adultPrice)}`,
      `Sena sugerida: ${formatMoney(totals.depositAmount)}`
    ];
  }

  return optionKeys.flatMap((key) => {
    const optionTotals = calculateForMenu(data, key);
    const menu = menuPresets[key] || menuPresets.custom;
    const lines = [
      `${menu.title}: ${formatMoney(optionTotals.grandTotal)}`,
      `Valor por adulto: ${formatMoney(optionTotals.adultPrice)}`,
      `Sena sugerida: ${formatMoney(optionTotals.depositAmount)}`
    ];
    if (data.invoice) lines.push(`Con factura: ${formatMoney(optionTotals.taxedTotal)}`);
    return lines.concat("");
  });
}


function render() {
  const data = readForm();
  const totals = calculate(data);

  quoteCode.textContent = data.id;
  element("effectiveGuests").textContent = numberFormatter.format(totals.effectiveGuests);
  element("staffCount").textContent = numberFormatter.format(totals.staffCount);
  element("grandTotal").textContent = formatMoney(totals.grandTotal);
  element("adultPrice").textContent = formatMoney(totals.adultPrice);
  element("depositAmount").textContent = formatMoney(totals.depositAmount);
  element("taxedTotal").textContent = formatMoney(totals.taxedTotal);

  quotePreview.innerHTML = buildPreview(data, totals);
  const message = buildMessage(data, totals);
  messagePreview.value = message;

  const phone = String(data.clientPhone || "").replace(/[^\d]/g, "");
  element("whatsappButton").href = phone
    ? `https://wa.me/54${phone}?text=${encodeURIComponent(message)}`
    : `https://wa.me/?text=${encodeURIComponent(message)}`;

  statusPill.textContent = state.activeId ? "Editando" : "Sin guardar";
}

function updatePresetPrice(shouldRender = true) {
  const key = quoteMenuKeys(readForm())[0];
  const preset = menuPresets[key];
  const priceInput = element("pricePerPerson");
  const sweetInput = element("sweetTablePrice");
  if (preset && preset.price > 0) {
    priceInput.value = preset.price;
  }
  if (preset && Number.isFinite(preset.sweetTablePrice)) {
    sweetInput.value = preset.sweetTablePrice;
  }
  if (shouldRender) render();
}

async function saveCurrentQuote() {
  const data = readForm();
  state.activeId = data.id;
  state.draftId = data.id;
  statusPill.textContent = "Guardando...";
  await saveQuote(data);
  statusPill.textContent = firebaseState.user ? "Guardado online" : "Guardado local";
  renderSavedList();
  render();
}

function loadSavedQuotes() {
  try {
    const parsed = JSON.parse(localStorage.getItem("cateringQuotes") || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function hasFirebaseConfig() {
  const config = window.firebaseConfig || {};
  return Boolean(config.apiKey && config.authDomain && config.projectId && config.appId);
}

function initFirebase() {
  if (!window.firebase || !hasFirebaseConfig()) {
    setAuthMode("local");
    return;
  }

  try {
    window.firebase.initializeApp(window.firebaseConfig);
    firebaseState.auth = window.firebase.auth();
    firebaseState.db = window.firebase.firestore();
    firebaseState.enabled = true;
    setAuthMode("signed-out");

    firebaseState.auth.onAuthStateChanged(async (user) => {
      firebaseState.user = user;
      if (user) {
        setAuthMode("signed-in", user.email);
        state.saved = await loadCloudQuotes();
      } else {
        setAuthMode("signed-out");
        state.saved = loadSavedQuotes();
      }
      renderSavedList();
    });
  } catch (error) {
    console.error("Firebase init failed", error);
    firebaseState.enabled = false;
    setAuthMode("local");
  }
}

function setAuthMode(mode, email = "") {
  if (!authStatus || !authFields || !logoutButton) return;

  if (mode === "signed-in") {
    authStatus.textContent = `Conectado: ${email}`;
    authFields.classList.add("hidden");
    logoutButton.classList.remove("hidden");
    setPublicMode(false);
    return;
  }

  if (mode === "signed-out") {
    authStatus.textContent = "Solicitud publica - ingresa para administrar";
    authFields.classList.remove("hidden");
    logoutButton.classList.add("hidden");
    setPublicMode(true);
    return;
  }

  authStatus.textContent = "Modo local - falta configurar Firebase";
  authFields.classList.remove("hidden");
  logoutButton.classList.add("hidden");
  setPublicMode(true);
}

function setPublicMode(isPublic) {
  document.body.classList.toggle("public-mode", isPublic);
  workspace.classList.remove("hidden");
  topbarActions.classList.toggle("hidden", isPublic);
}

async function signIn() {
  if (!firebaseState.enabled) return;
  const email = authEmail.value.trim();
  const password = authPassword.value;
  if (!email || !password) {
    authStatus.textContent = "Completa email y contrasena";
    return;
  }

  try {
    authStatus.textContent = "Ingresando...";
    await firebaseState.auth.signInWithEmailAndPassword(email, password);
    authPassword.value = "";
  } catch (error) {
    authStatus.textContent = "No se pudo ingresar";
    console.error("Login failed", error);
  }
}

async function signOut() {
  if (!firebaseState.enabled) return;
  await firebaseState.auth.signOut();
}

function cloudCollection() {
  return firebaseState.db.collection("requests");
}

async function loadCloudQuotes() {
  if (!firebaseState.enabled || !firebaseState.user) return loadSavedQuotes();
  try {
    const snapshot = await cloudCollection().orderBy("updatedAt", "desc").get();
    return snapshot.docs.map((doc) => ({ ...doc.data(), id: doc.id }));
  } catch (error) {
    console.error("Cloud load failed", error);
    authStatus.textContent = error.code === "permission-denied"
      ? "Conectado, pero faltan publicar las reglas de Firestore"
      : "Conectado, pero no se pudieron cargar solicitudes";
    return [];
  }
}

async function saveQuote(data) {
  if (firebaseState.enabled && firebaseState.user) {
    await cloudCollection().doc(data.id).set({
      ...data,
      status: data.status || "en_revision",
      ownerUid: firebaseState.user.uid
    }, { merge: true });
    state.saved = await loadCloudQuotes();
    return;
  }

  const index = state.saved.findIndex((quote) => quote.id === data.id);
  if (index >= 0) {
    state.saved[index] = data;
  } else {
    state.saved.unshift(data);
  }
  localStorage.setItem("cateringQuotes", JSON.stringify(state.saved));
}

async function submitPublicRequest() {
  publicSubmitStatus.textContent = "Revisando solicitud...";
  const data = readForm();
  const requiredFields = [
    ["clientName", "nombre"],
    ["clientPhone", "WhatsApp"],
    ["eventDate", "fecha del evento"],
    ["venue", "lugar"]
  ];
  const missing = requiredFields.find(([field]) => !String(data[field] || "").trim());

  if (missing) {
    publicSubmitStatus.textContent = `Falta completar ${missing[1]}.`;
    return;
  }

  if (!firebaseState.enabled) {
    if (!hasFirebaseConfig()) {
      publicSubmitStatus.textContent = "Todavia estamos configurando el envio online.";
      return;
    }

    try {
      publicSubmitButton.disabled = true;
      publicSubmitStatus.textContent = "Enviando...";
      await savePublicRequestViaRest(data);
      sendWhatsAppNotification(data);
      startNewQuote();
      publicSubmitStatus.textContent = "Solicitud enviada. Te vamos a responder por WhatsApp.";
    } catch (error) {
      console.error("Public REST request failed", error);
      publicSubmitStatus.textContent = "No se pudo enviar. Falta publicar reglas o terminar Firebase.";
    } finally {
      publicSubmitButton.disabled = false;
    }
    return;
  }

  try {
    publicSubmitButton.disabled = true;
    publicSubmitStatus.textContent = "Enviando...";
    await cloudCollection().doc(data.id).set({
      ...data,
      status: "solicitud_recibida",
      source: "public_form",
      createdAt: new Date().toISOString()
    });
    sendWhatsAppNotification(data);
    startNewQuote();
    publicSubmitStatus.textContent = "Solicitud enviada. Te vamos a responder por WhatsApp.";
  } catch (error) {
    console.error("Public request failed", error);
    publicSubmitStatus.textContent = error.code === "permission-denied"
      ? "Falta publicar las reglas de Firestore para recibir solicitudes."
      : "No se pudo enviar. Proba de nuevo en unos minutos.";
  } finally {
    publicSubmitButton.disabled = false;
  }
}

async function sendWhatsAppNotification(data) {
  const optionKeys = quoteMenuKeys(data);
  const payload = {
    ...data,
    menuNames: optionKeys.map((key) => menuPresets[key].title).join(" / ")
  };

  try {
    const response = await fetch("/api/send-budget-notification", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      console.warn("WhatsApp notification failed");
    }
  } catch (error) {
    console.warn("WhatsApp notification unavailable", error);
  }
}

async function savePublicRequestViaRest(data) {
  const config = window.firebaseConfig;
  const url = `https://firestore.googleapis.com/v1/projects/${config.projectId}` +
    `/databases/(default)/documents/requests?documentId=${encodeURIComponent(data.id)}` +
    `&key=${encodeURIComponent(config.apiKey)}`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      fields: toFirestoreFields({
        ...data,
        status: "solicitud_recibida",
        source: "public_form",
        createdAt: new Date().toISOString()
      })
    })
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(details || `Firestore REST error ${response.status}`);
  }
}

function toFirestoreFields(data) {
  return Object.fromEntries(
    Object.entries(data).map(([key, value]) => [key, toFirestoreValue(value)])
  );
}

function toFirestoreValue(value) {
  if (value === null || value === undefined) return { nullValue: null };
  if (typeof value === "boolean") return { booleanValue: value };
  if (typeof value === "number") {
    return Number.isInteger(value)
      ? { integerValue: String(value) }
      : { doubleValue: value };
  }
  if (Array.isArray(value)) {
    return { arrayValue: { values: value.map(toFirestoreValue) } };
  }
  if (typeof value === "object") {
    return { mapValue: { fields: toFirestoreFields(value) } };
  }
  return { stringValue: String(value) };
}

function renderSavedList() {
  savedCount.textContent = state.saved.length;
  if (!state.saved.length) {
    savedList.innerHTML = `<p class="saved-empty">Todavia no hay solicitudes guardadas en este navegador.</p>`;
    return;
  }

  savedList.innerHTML = state.saved.map((quote) => {
    const totals = calculate(quote);
    return `
      <button class="saved-item" type="button" data-id="${escapeHtml(quote.id)}">
        <strong>${escapeHtml(quote.clientName || "Sin nombre")}</strong>
        <span>${formatDate(quote.eventDate)} - ${formatMoney(totals.grandTotal)}</span>
      </button>
    `;
  }).join("");
}

function startNewQuote() {
  state.activeId = null;
  state.draftId = createQuoteId();
  form.reset();
  element("adults").value = 80;
  element("children").value = 0;
  element("quotePremium").checked = true;
  element("quotePernil").checked = false;
  element("quoteCustom").checked = false;
  element("eventType").value = "Cumpleanos";
  element("serviceDuration").value = "5 hs";
  element("kitchenAvailable").value = "A confirmar";
  element("eventZone").value = "";
  element("sweetTable").checked = true;
  element("staff").checked = true;
  element("foodTruck").checked = false;
  element("invoice").checked = false;
  element("pricePerPerson").value = menuPresets.premium.price;
  element("sweetTablePrice").value = 3000;
  element("staffUnitPrice").value = 150000;
  element("staffPrice").value = 600000;
  element("foodTruckPrice").value = 150000;
  element("otherExtras").value = 0;
  element("depositPercent").value = 15;
  element("taxPercent").value = 21;
  element("internalNotes").value = "";
  render();
}

async function copyMessage() {
  try {
    await navigator.clipboard.writeText(messagePreview.value);
    copyStatus.textContent = "Copiado";
    setTimeout(() => {
      copyStatus.textContent = "Listo";
    }, 1800);
  } catch {
    messagePreview.select();
    document.execCommand("copy");
    copyStatus.textContent = "Copiado";
  }
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function closeIntro() {
  if (!introScreen) return;
  introScreen.classList.add("is-hidden");
}

document.addEventListener("input", (event) => {
  if (event.target.matches("input, select, textarea")) render();
});

document.addEventListener("change", (event) => {
  if (["quotePremium", "quotePernil", "quoteCustom"].includes(event.target.id)) {
    if (!hasCheckedMenu(readMenuChecks())) {
      element("quotePremium").checked = true;
    }
    updatePresetPrice(true);
    return;
  }
  if (event.target.matches("input, select, textarea")) render();
});

savedList.addEventListener("click", (event) => {
  const button = event.target.closest(".saved-item");
  if (!button) return;
  const quote = state.saved.find((item) => item.id === button.dataset.id);
  if (quote) writeForm(quote);
});

element("saveQuoteButton").addEventListener("click", saveCurrentQuote);
element("newQuoteButton").addEventListener("click", startNewQuote);
element("copyMessageButton").addEventListener("click", copyMessage);
element("printButton").addEventListener("click", () => window.print());
element("enterAppButton").addEventListener("click", closeIntro);
loginButton.addEventListener("click", signIn);
logoutButton.addEventListener("click", signOut);
publicSubmitButton.addEventListener("click", submitPublicRequest);
authPassword.addEventListener("keydown", (event) => {
  if (event.key === "Enter") signIn();
});

if (introVideo) {
  introVideo.addEventListener("ended", closeIntro);
  introVideo.addEventListener("error", closeIntro);
  setTimeout(closeIntro, 6500);
}

renderSavedList();
startNewQuote();
initFirebase();
