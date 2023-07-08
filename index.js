const fs = require('fs').promises;
const path = require('path');
const process = require('process');
const {authenticate} = require('@google-cloud/local-auth');
const {google} = require('googleapis');

// Credentials for using the Gmail API. These are obtained from the Google Cloud Platform.
const CREDENTIALS_PATH = path.join(process.cwd(), 'credentials.json');
// The token.json file stores the user's access and refresh tokens, and is created automatically when the authorization flow completes for the first time.
const TOKEN_PATH = path.join(process.cwd(), 'token.json');
// Complete access to Gmail API. Specific scopes can be added as needed.
const SCOPES = ['https://mail.google.com'];
const PROCESS_START_TIMESTAMP = Date.now();



// If OAuth has been used before and a token.json file exists, it is loaded and used to authenticate.
const loadSavedCredentialsIfExist = async () => {
  try {
    const content = await fs.readFile(TOKEN_PATH);
    const credentials = JSON.parse(content);
    return google.auth.fromJSON(credentials);
  } catch (err) {
    return null;
  }
}

// Whenever OAuth is used, the credentials are saved back to the token.json file.
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

// Calling OAuth to authenticate and save credentials.
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


// Creates a label if it doesn't exist.
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
  return label;
}

// Generates the raw email content to be sent as a reply.
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
  
  return {encodedMessage, from};
}

// Main function that checks for unread emails, sends a reply and adds a label.
const autoReply = async (auth) => {
  if(!auth) throw err;
  let gmail = google.gmail({version: 'v1', auth});
  let label = await createLabel(gmail, 'Vacation Email');

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
          let {encodedMessage, from} = generateEmailContent(thread.data.messages[0])
          await gmail.users.messages.send({
            userId: 'me',
            requestBody: {
              raw: encodedMessage,
              threadId: unreadMessage.threadId,
            },
          })
          gmail.users.threads.modify({
            userId: 'me',
            id: unreadMessage.threadId,
            requestBody: {
              removeLabelIds: ['INBOX'],
              addLabelIds: [label.id],
            },
          })
          console.log(`Replied to ${from}`)
          console.log(`Added label ${label.name} to the thread ${unreadMessage.threadId}`)
        }
      })
    })
  }
}



authorize().then((auth) => {
  console.log(`Process started at: ${PROCESS_START_TIMESTAMP}`)
  setInterval(() => autoReply(auth), Math.floor(45 + Math.random()*75) *1000)
}).catch(console.error);