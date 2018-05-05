# Factom Proof of Support

This repository holds DBGrow's Proof of Support Application(POS). **Currently Pre-Alpha**. This project is currently formatted as an internally used project and is not packaged for command line or library use. 

At this time changes are not guaranteed to be backwards compatible!

This repository will be developed into a convenient package for other organizations to use, according to DBGrow's development roadmap, by the end of May 2018.

## Purpose

Provide a way for persistent support teams to prove publicly that they are/were actively present to support a service. Team members submit signed "checkin" messages to the POS server at regular intervals, which are then entered into the Factom blockchain to persist forever.

Notifications may be dispatched to team members if a valid support checkin has not been made for a period of time(coming soon) via phone or email.

## Structure

The application is composed of two chains:

- The **Contact Chain** which keeps track of the organization's support members and their respective public keys
-  The **Checkin Chain** which keeps track of signed checkins/messages from the organization's support members

The first entry in each chain is a `meta` entry that contains authentication information relating to the chain/organization. Each `meta` entry contains the public key of the organization's administrator, a nonce, and the nonce signed by the organization's administrator.

Entries made on the **Contacts Chain** to add contacts must each be signed by the organization administrator's private key to be deemed authentic.

The public key of the organization administrator in the **Contacts** and **Checkin** chain must match eachother!

## Prerequisites

- Factom follower node with API and Wallet ports exposed running on localhost (will add ability to use external hosts soon)
- Entry credit address loaded with EC's

The project currently uses some libraries/services for DBGrow's internal use. These prerequisites will be phased out as we move towards a general release:

- Twilio API Keys for support team SMS/Call notifications
- AWS SES API keys for support team email notifications (DBGrow uses AWS:SES)

These are exposed as environment variables for now:

- `AWS_KEY_ID`
- `AWS_SECRET_KEY`
- `TWILIO_SID`
- `TWILIO_TOKEN`

Leaving these out may cause errors but this will be fixed soon.

## Installation

```bash
git clone https://github.com/DBGrow/factom-proof-of-support.git
cd factom-proof-of-support
npm install
```

## First Time Setup

To use this repo, you must fill in some credentials and create the keys your organization will use to sign and authenticate changes to the chains:

### Populate `contacts.json`

You must populate the `contacts.json` file in `factom-proof-of-support/contacts` with your team member's details. The file is an array of your organization's contacts that will be notified in the event of a support event. This file also serves to hold the public keys of your support staff.

```json
[
  {
    "id": "353516811779",
    "name": "Devon",
    "emails": [
      "devonk@dbgrow.com"
    ],
    "phone": "+11231231234",
    "public_key": "-----BEGIN PUBLIC KEY-----MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEApSBxT+1+SihyXOYANWnBiZFoM05oMM95zwxReG/TxfYRL3IcWRQ3cvlh6JuvIFCZHS5B+wjrkokujKXkdh3ckzkV0yyDUnkIQwFnAv2ASwYO0kcD6yrYBENic0b2ebnq5LW69Iou370Tm4ThkVUm8LXBla7FTuIGDlwtt7HhAEf64Yxb+wax9Zky5XLVtf6pegmJW3jEZ8USo/gGFbp2IADOH5VkpPMa48r+98YiKbhrs2gjfAaReyd5iI9xgE8YIA3P5wlAXvzNY3uA24DF0PdpnnefuI1SrdEbb2V69g70LIUzV8mEtkbIEJFLywd7Clb9tJqkKwEkb12R0RyQMwIDAQAB-----END PUBLIC KEY-----"
  }
]
```

`id` should be some unique string for each contact.

`public_key` should be a 2048B RSA PEM encoded public key for your contact.

### Edit `config.json`

Set your app's unique ID in `./config.json`:

`salt` is a random arbitrary value that lets you create different 'versions' of your support app for testing. Change to `` to use the release version of your app. Change to a random value to create a new version.

`support_app_id` is the unique ID of your support application. Change this to a custom valu!

```
{
  "salt": "aksdj23fn28fn",
  "support_app_id": "unique_app_id"
}
```

### Generate Organization Administrator Keys

Directory `factom-proof-of-support/keys/support`  holds the cryptographic root keys for your organization. These keys will be needed to generate the application's chains and add new contacts. <u>If you are using this repo only for submitting checkins, generating these keys is not required.</u> This repo will not come with these, so you must generate them yourself before your first run. Keep track of these keys or you will not be able to add new support team members!

**Generate the keys:**

```bash
cd keys/support/
openssl genrsa -out key.pem 2048
openssl rsa -in key.pem -outform PEM -pubout -out public.pem
```

### Initialize Contacts and Checkin chains

You will need to create your new support app's **Contact** and **Checkin** chains before getting started doing checkins! After you initialize, 

Generate and sign the chains using the keys generated in the previous step:

```bash
node init/init.js
```

You will need to wait up to 10 Minutes for your new chain's to be confirmed!

After confirmation proceed to the next step.

## Start Proof Of Support Server

The proof of support service is exposed as an HTTP server on port 3000 using `express`.

```bash
node index.js
```

## Sending A Checkin

Heres an example of sending a signed support checkin over HTTP in node using unirest and node-rsa:

```
var unirest = require('unirest');
var NodeRSA = require('node-rsa');
var fs = require('fs');

//load the private key for the support team contact
//Devon will be signin this checkin
var private_support_key_string = fs.readFileSync('./key.pem').toString();

var private_support_key = new NodeRSA();
private_support_key.importKey(private_support_key_string, 'private');

//get a nonce from the POS server
unirest.get('http://localhost:3000/nonce').end(function (response) {
    var nonce = response.body;

    console.log('CLIENT: got nonce: ' + nonce);

    //sign the nonce with the team member's private key
    var signed_nonce = private_support_key.sign(nonce, 'hex', 'utf8').toString();

    var message = "I'm a teapot...";
	//compose the checkin URL params and send the checkin POST request
    unirest.post('http://localhost:3000/checkin?nonce=' + encodeURIComponent(nonce) + '&signed_nonce=' + encodeURIComponent(signed_nonce) + '&message=' + encodeURIComponent(message))
        .end(function (response) {

            if (response.code != 200) console.error('HTTPERROR: ' + response.code + ' : ' + response.body);
            else console.log('SUCCESS COMMITTING CHECKIN!!!')
        });
});
```

This will trigger a new entry in the applications **Checkin Chain** with the following content:

```
{"type":"checkin","signer":"Devon","message":"I'm a teapot...","nonce":"a1b87948cfe6b11a5742e75ca5b34368","signed_nonce":"8acac7dc3f63b1ee446482ebed4026d898461ced2261e6e9099eead0761b5da69b65dcf1574a3d1a27b64e04a14c0ddc2cbc46759be83584760f0f773646fe2a8be7b457a4ddf02effee0c1bca6bc55f77ebf09bddc255137bdb9107b19d56a503390765d15185463510acb2282794ea37d0a59e8aceea4443fdd952f314978cf523bcae9dd7f583aab5c2305b48ab5a59b32ab70d51bf818226c895d9e64a04d69a31a3872d29ccfbf2398e22726dbe494be16f100582c56341246b5ac2f90e81996d75afee1a8c4713483dbfedc512f01f49c22fe1647b2238cebce528bdf16c91a4962dc4a3031825cea93ad1d3d428117b65faa0ff3e8c9a3d5c69e85849"}
```

