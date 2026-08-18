const { onRequest } = require("firebase-functions/v2/https");
const { defineSecret, defineString } = require("firebase-functions/params");
const logger = require("firebase-functions/logger");

const whatsappAccessToken = defineSecret("WHATSAPP_ACCESS_TOKEN");
const whatsappPhoneNumberId = defineString("WHATSAPP_PHONE_NUMBER_ID");
const whatsappRecipientPhone = defineString("WHATSAPP_RECIPIENT_PHONE", {
  default: "5492215252925"
});
const whatsappGraphVersion = defineString("WHATSAPP_GRAPH_VERSION", {
  default: "v26.0"
});

const allowedOrigins = [
  "https://lacocinadelbondi.web.app",
  "https://lacocinadelbondi.firebaseapp.com",
  "https://lacocinadelbondi.com.ar"
];

exports.sendBudgetNotification = onRequest(
  {
    region: "us-central1",
    cors: allowedOrigins,
    secrets: [whatsappAccessToken]
  },
  async (req, res) => {
    if (req.method !== "POST") {
      res.status(405).json({ ok: false, error: "method_not_allowed" });
      return;
    }

    const data = req.body || {};
    const message = buildNotificationMessage(data);

    if (!data.clientName || !data.clientPhone || !data.eventDate || !data.venue) {
      res.status(400).json({ ok: false, error: "missing_required_fields" });
      return;
    }

    try {
      const response = await fetch(
        `https://graph.facebook.com/${whatsappGraphVersion.value()}/${whatsappPhoneNumberId.value()}/messages`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${whatsappAccessToken.value()}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            messaging_product: "whatsapp",
            recipient_type: "individual",
            to: whatsappRecipientPhone.value(),
            type: "text",
            text: {
              preview_url: false,
              body: message
            }
          })
        }
      );

      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        logger.error("WhatsApp notification failed", {
          status: response.status,
          result
        });
        res.status(502).json({ ok: false, error: "whatsapp_failed" });
        return;
      }

      res.json({ ok: true });
    } catch (error) {
      logger.error("WhatsApp notification crashed", error);
      res.status(500).json({ ok: false, error: "internal_error" });
    }
  }
);

function buildNotificationMessage(data) {
  return [
    "Nueva solicitud de presupuesto desde la web",
    "",
    `Cliente: ${clean(data.clientName)}`,
    `WhatsApp: ${clean(data.clientPhone)}`,
    `Fecha del evento: ${clean(data.eventDate)} (${clean(data.eventTime || "A definir")})`,
    `Tipo de evento: ${clean(data.eventType || "A definir")}`,
    `Lugar: ${clean(data.venue)}`,
    `Zona: ${clean(data.eventZone || "A definir")}`,
    `Invitados: ${clean(data.adults || 0)} adultos${Number(data.children || 0) ? ` + ${clean(data.children)} menores de 2 a 8 años` : ""}`,
    `Menus solicitados: ${clean(data.menuNames || "A definir")}`,
    data.notes ? `Observaciones: ${clean(data.notes)}` : ""
  ].filter(Boolean).join("\n");
}

function clean(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim().slice(0, 500);
}
