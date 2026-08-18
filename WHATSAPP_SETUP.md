# WhatsApp Business API

La pagina ya tiene preparado el endpoint `/api/send-budget-notification`.
Ese endpoint se conecta con una Firebase Function y manda el aviso a WhatsApp cuando entra una solicitud.

## Datos necesarios

En Meta / WhatsApp Cloud API hay que obtener:

- `WHATSAPP_ACCESS_TOKEN`: token permanente o de sistema para WhatsApp Cloud API.
- `WHATSAPP_PHONE_NUMBER_ID`: ID del numero emisor de WhatsApp Business.
- `WHATSAPP_RECIPIENT_PHONE`: numero que recibe los avisos. Para Eze: `5492215252925`.
- `WHATSAPP_GRAPH_VERSION`: version de Graph API. Sugerida: `v26.0`.

## Configuracion local

Crear `functions/.env` tomando como base `functions/.env.example`:

```env
WHATSAPP_GRAPH_VERSION=v26.0
WHATSAPP_PHONE_NUMBER_ID=123456789000000
WHATSAPP_RECIPIENT_PHONE=5492215252925
```

El token no va en `.env`. Va como secreto:

```powershell
npx.cmd firebase-tools functions:secrets:set WHATSAPP_ACCESS_TOKEN
```

Despues desplegar Functions y Hosting:

```powershell
npx.cmd firebase-tools deploy --only functions,hosting
```

## Nota importante

Firebase Functions normalmente requiere tener el proyecto en plan Blaze.

WhatsApp Cloud API puede exigir plantillas aprobadas para mensajes iniciados por la empresa. Si Meta rechaza el envio de texto libre, hay que crear una plantilla de notificacion en WhatsApp Manager y adaptar la Function para usar esa plantilla.
