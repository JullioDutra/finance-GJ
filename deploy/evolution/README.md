# Evolution API na VPS

1. Copie esta pasta para a VPS e rode `bash instalar.sh` (instala Docker se precisar, gera senhas e sobe Evolution v2.3.7 + Postgres + Redis).
2. Abra `http://IP_DA_VPS:8080/manager`, entre com a chave mostrada no fim da instalação, crie a instância (ex.: `financas`) e leia o QR Code com o WhatsApp do robô.
3. Rode `bash ligar-webhook.sh financas TOKEN` — `TOKEN` é o `WHATSAPP_WEBHOOK_TOKEN` da Vercel.
4. No app, em **Ajustes → Casal e casamento**, preencha os WhatsApps de vocês dois e mande `ajuda` para o número do robô.

Logs: `cd ~/evolution && docker compose logs -f api`
