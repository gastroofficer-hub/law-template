require('dotenv').config();
const express = require('express');
const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');

const app = express();
const client = new Client({ intents: [GatewayIntentBits.Guilds] });

app.use(express.static('public'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const rankMap = {
  'deputy': 'Deputy',
  'corporal': 'Master FTO',
  'sergeant': 'Sergeant',
  'lieutenant': 'Lieutenant',
  'captain': 'Captain',
  'commander': 'Commander',
  'undersheriff': 'Under-Sheriff',
  'sheriff': 'Sheriff'
};

const detentionStatusMap = {
  'custody': 'Ve vazbě',
  'bail': 'Propuštěn na kauci',
  'release': 'Propuštěn (bez poplatků)',
  'awaiting': 'Čekání na prodloužení vazby'
};

const extensionMap = {
  '48hours': '48 Hodin',
  '72hours': '72 Hodin',
  '5days': '5 Dní',
  '10days': '10 Dní',
  '14days': '14 Dní',
  '30days': '30 Dní'
};

const prosecutionStatusMap = {
  'pending': 'Čeká na vyhodnocení',
  'approved': 'Schváleno',
  'denied': 'Zamítnuto',
  'modified': 'Schváleno s úpravami',
  'investigation': 'Vyžaduje další prošetření'
};

function formatField(name, value) {
  if (!value || value.trim() === '') return null;
  return `**${name}:** ${value}`;
}

app.post('/submit', (req, res) => {
  const body = req.body;

  const embed = new EmbedBuilder()
    .setTitle('🔴 Nová DOJ žádost')
    .setColor(0x2b4b24)
    .setTimestamp()
    .setFooter({ text: 'Los Santos County Sheriff Department' });

  let requestInfo = [];
  requestInfo.push(formatField('Číslo případu', body.caseNumber));
  requestInfo.push(formatField('Datum žádosti', body.requestDate));
  requestInfo.push(formatField('Požadující člen', body.requestingOfficer));
  requestInfo.push(formatField('Hodnost', rankMap[body.rank] || body.rank));
  embed.addFields({ name: '📋 Informace o žádosti', value: requestInfo.filter(Boolean).join('\n') || 'N/A', inline: false });

  let suspectInfo = [];
  suspectInfo.push(formatField('Celé jméno', body.suspectName));
  suspectInfo.push(formatField('Datum narození', body.suspectDOB));
  suspectInfo.push(formatField('ID Číslo / Licence', body.suspectID));
  suspectInfo.push(formatField('Stav zadržení', detentionStatusMap[body.detentionStatus] || body.detentionStatus));
  suspectInfo.push(formatField('Datum zajištění', body.arrestDate));
  embed.addFields({ name: '👤 Informace o pachateli', value: suspectInfo.filter(Boolean).join('\n') || 'N/A', inline: false });

  let extensionInfo = [];
  extensionInfo.push(formatField('Platnost vazby do', body.currentBailExpiry));
  extensionInfo.push(formatField('Požadované prodloužení', extensionMap[body.requestedExtension] || body.requestedExtension));
  if (body.extensionReason) {
    extensionInfo.push(`\n**Odůvodnění:**\n${body.extensionReason}`);
  }
  embed.addFields({ name: '⏰ Žádost o prodloužení vazby', value: extensionInfo.filter(Boolean).join('\n') || 'N/A', inline: false });

  let chargesInfo = [];
  chargesInfo.push(formatField('Prvotní obvinění', body.primaryCharge));
  if (body.chargeNarrative) {
    chargesInfo.push(`\n**Okolnosti obvinění:**\n${body.chargeNarrative}`);
  }
  if (body.additionalCharges) {
    chargesInfo.push(`\n**Dodatečné obvinění:**\n${body.additionalCharges}`);
  }
  embed.addFields({ name: '⚖️ Obvinění', value: chargesInfo.filter(Boolean).join('\n') || 'N/A', inline: false });

  let evidenceInfo = [];
  if (body.evidenceList && Array.isArray(body.evidenceList) && body.evidenceList.length > 0) {
    body.evidenceList.forEach((ev, idx) => {
      if (ev.type || ev.description) {
        evidenceInfo.push(`${idx + 1}. **${ev.type || 'N/A'}**\n   ${ev.description || ''}`);
      }
    });
  }
  if (body.evidenceNotes) {
    evidenceInfo.push(`\n**Poznámky k evidenci:**\n${body.evidenceNotes}`);
  }
  embed.addFields({ name: '📦 Evidence & Dokumentace', value: evidenceInfo.length > 0 ? evidenceInfo.join('\n\n') : 'Žádná evidence', inline: false });

  let witnessesInfo = [];
  if (body.witnesses) witnessesInfo.push(`**Seznam svědků:**\n${body.witnesses}`);
  if (body.statements) witnessesInfo.push(`\n**Shrnutí výpovědí:**\n${body.statements}`);
  if (witnessesInfo.length > 0) {
    embed.addFields({ name: '👥 Svědci a výpovědi', value: witnessesInfo.join('\n\n'), inline: false });
  }

  let attorneyInfo = [];
  attorneyInfo.push(formatField('Přidělený Attorney', body.assignedProsecutor));
  attorneyInfo.push(formatField('Status', prosecutionStatusMap[body.prosecutionStatus] || body.prosecutionStatus));
  if (body.prosecutorNotes) {
    attorneyInfo.push(`\n**Poznámky Attorney:**\n${body.prosecutorNotes}`);
  }
  embed.addFields({ name: '⚖️ State Attorney', value: attorneyInfo.filter(Boolean).join('\n') || 'N/A', inline: false });

  let signaturesInfo = [];
  signaturesInfo.push(formatField('Žádající jednotka', body.requestingOfficerSig));
  signaturesInfo.push(formatField('Schválení nadřízeným', body.supervisorApproval));
  if (body.dojSignature) signaturesInfo.push(formatField('Podpis Attorney', body.dojSignature));
  if (body.approvalDate) signaturesInfo.push(formatField('Datum schválení', body.approvalDate));
  embed.addFields({ name: '✍️ Certifikace & Podpisy', value: signaturesInfo.filter(Boolean).join('\n') || 'N/A', inline: false });

  if (body.additionalNotes) {
    embed.addFields({ name: '📝 Další poznámky', value: body.additionalNotes, inline: false });
  }

  const channel = client.channels.cache.get(process.env.LOG_CHANNEL_ID);
  if (channel) {
    channel.send({ embeds: [embed] });
  }

  res.send('Žádost byla odeslána. Můžete zavřít okno.');
});

client.once('ready', () => {
  console.log(`Bot je online jako ${client.user.tag}`);
});

client.login(process.env.BOT_TOKEN);

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Web server běží na http://localhost:${PORT}`);
});
