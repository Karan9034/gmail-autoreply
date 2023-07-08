const fs = require('fs').promises;
const path = require('path');
const process = require('process');
const {authenticate} = require('@google-cloud/local-auth');
const {google} = require('googleapis');

const SCOPES = ['https://mail.google.com'];
const TOKEN_PATH = path.join(process.cwd(), 'token.json');
const CREDENTIALS_PATH = path.join(process.cwd(), 'credentials.json');
const PROCESS_START_TIMESTAMP = Date.now();


const loadSavedCredentialsIfExist = async () => {
  try {
    const content = await fs.readFile(TOKEN_PATH);
    const credentials = JSON.parse(content);
    return google.auth.fromJSON(credentials);
  } catch (err) {
    return null;
  }
}
const saveCredentials = async (client) => {
  const content = await fs.readFile(CREDENTIALS_PATH);
  const keys = JSON.parse(content);
  const key = keys.installed || keys.web;
  const payload = JSON.stringify({
    type: 'authorized_user',
    client_id: key.client_id,
    client_secret: key.client_secret,
    refresh_token: client.credentials.refresh_token,
  });
  await fs.writeFile(TOKEN_PATH, payload);
}
const authorize = async () => {
  let client = await loadSavedCredentialsIfExist();
  if (client) {
    return client;
  }
  client = await authenticate({
    scopes: SCOPES,
    keyfilePath: CREDENTIALS_PATH,
  });
  if (client.credentials) {
    await saveCredentials(client);
  }
  return client;
}

const createLabel = async (gmail, labelName) => {
  let res = await gmail.users.labels.list({
    userId: 'me',
  });
  let labels = res.data.labels;
  let label = labels.find((label) => label.name === labelName);
  if (!label) {
    res = await gmail.users.labels.create({
      userId: 'me',
      requestBody: {
        name: labelName,
        labelListVisibility: 'labelShow',
        messageListVisibility: 'show',
      },
    });
    label = res.data;
  }
  return label.id;
}
const generateEmailContent = (email) => {
  let from = ''
  let to = ''
  let subject = ''
  email.payload.headers.map((header) => {
    if(header.name === 'From') from = header.value;
    if(header.name === 'To') to = header.value;
    if(header.name === 'Subject') subject = 'Re: ' + header.value;
  })
  let message = `From: ${to}
To: ${from}
Subject: ${subject}

Hey there,

I'm on vacation and will get back to you when I return.

Thanks.`;

  const encodedMessage = Buffer.from(message)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
  
  return encodedMessage;
}

const autoReply = async (auth) => {
  if(!auth) throw err;
  let gmail = google.gmail({version: 'v1', auth});
  let labelId = await createLabel(gmail, 'Vacation Email');

  let res = await gmail.users.messages.list({
    userId: 'me',
    labelIds: ['UNREAD', 'INBOX'],
    maxResults: 10,
  });
  let unreadMessages = res.data.messages;
  
  if(unreadMessages && unreadMessages.length > 0) {
    unreadMessages.map(async (unreadMessage) => {
      gmail.users.threads.get({
        userId: 'me',
        id: unreadMessage.threadId,
      }).then(async (thread) => {
        if(thread.data.messages.length === 1 && thread.data.messages[0].internalDate > PROCESS_START_TIMESTAMP){
          let email = generateEmailContent(thread.data.messages[0])
          await gmail.users.messages.send({
            userId: 'me',
            requestBody: {
              raw: email,
              threadId: unreadMessage.threadId,
            },
          })
          gmail.users.threads.modify({
            userId: 'me',
            id: unreadMessage.threadId,
            requestBody: {
              removeLabelIds: ['INBOX'],
              addLabelIds: [labelId],
            },
          })
        }
      })
    })
  }
}



authorize().then((auth) => {
  autoReply(auth);
  setInterval(() => autoReply(auth), Math.floor(45 + Math.random()*75) *1000)
}).catch(console.error);