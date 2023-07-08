# gmail-autoreply

## Description

This is a simple script that will automatically reply to emails that are sent to a specific email address. It is intended to be used with a Gmail account.

## Instructions and Details

1. Go to Google Cloud Platform, enable the Gmail API, and create a new OAuth 2.0 Client ID. Download the client secret JSON file and save it as `credentials.json` in the same directory as the script.

2. Use `npm install` to install the dependencies.

3. Run the script using `npm start` or `node index`. It will open a browser window and ask you to log in to your Google account. Then it will ask you to allow the script to access your Gmail account. Once you allow it, it will show a message saying that you can close the browser window.

4. The script will create a file called `token.json` in the same directory as the script. This file contains the OAuth 2.0 access token that the script uses to access your Gmail account. Keep this file in a safe place. If you lose it, you will have to repeat step 2.

5. The script will constantly look for Unread emails in your Inbox (i.e. emails labelled as `INBOX` and `UNREAD`) which are received after the script has been started. If it finds any, it will send an automatic reply to the sender of the email and adds the label `Vacation Email` and removes the label `INBOX`, and makes sure that the reply is sent only once.

## Scopes for Improvement

1. The script could be modified to not reply to emails that contain `noreply` or `no-reply` in the sender's email address.

2. If the user is added to an existing thread which he wasn't a part of, the script won't reply to that email. This could be fixed by checking if the user is a part of the thread or not by checking the receipents of each mail in the thread.