var fs = require('fs');

var crypto = require('crypto');
var NodeRSA = require('node-rsa');

//factom stuff
var {FactomCli} = require('factom');
var cli = new FactomCli();
var {Entry} = require('factom/src/entry');
var {Chain} = require('factom/src/chain');

var util = require('../routes/util');

var contacts = [];
var alert_max_interval_ms = 5 * 60000; //5 mins

function init() {
    fs.readFile('./contacts/contacts.json', function (err, contacts_data) {
        if (err) {
            console.log('No contacts file found. Starting from scratch...');
            return;
        }

        //load hosts from file
        contacts = JSON.parse(contacts_data);
        console.log('Found ' + contacts.length + ' Contacts!');

        contacts.forEach(function (contact) {
            //try to parse their public key
            var public_key = new NodeRSA();
            public_key.importKey(contact.public_key, 'public');
        })
    });
}

function commitAllContacts() {
    contacts.forEach(function (contact) {
        commitContact(contact);
    })
}

function commitContact(contact) {
    var chain_id = 'dbgrow_support';
    var contact_chain_id = getContactChainID(chain_id);
    console.log('Checking if contact chain with id ' + contact_chain_id + ' exists');

    //check if this chain exists already!
    cli.chainExists(contact_chain_id).then(function (exists) {
        if (!exists) {
            console.error('Contact chain did not exist yet! Please create it first')
            if (callback) callback(new Error('Chain did not exist yet! Please create it first'));
            return;
        }

        //set up signing
        var nonce = crypto.randomBytes(16).toString('hex');

        var private_support_key_string = fs.readFileSync('./keys/support/key.pem').toString();

        //check if this key exists
        var private_support_key = new NodeRSA();
        private_support_key.importKey(private_support_key_string, 'private');

        //sign this contact entry with the support app's admin private key
        var signed_nonce = private_support_key.sign(nonce, 'hex', 'utf8').toString();

        //this will be the content of our signed entries!
        var content = {
            type: 'contact',
            name: contact.name,
            public_key: contact.public_key,
            nonce: nonce,
            signed_nonce: signed_nonce,
        };


        //write an entry to the chain!

        console.log("chain exists! Writing entry...")

        var new_entry = Entry.builder()
            .chainId(contact_chain_id)
            .extId('' + new Date().getTime(), 'utf8')
            .content(JSON.stringify(content), 'utf8')
            .build()

        console.log(new_entry);

        cli.addEntry(new_entry, process.env.FACTOM_EC).then(function (entry) {
            console.log('Published new support entry!');
            console.log(entry);

            // if (callback) callback(undefined, entry);
        }).catch(function (err) {
            console.error(err);

            if (callback) callback(err);
            else console.error(err);
        });

        /*

                console.log('Chain does not exist! Creating:');

                //set the keys for the new support chain's root key.
                // Administrative actions such as adding contact signatures will be authenticated
                // using signed material from this public key's counterpart
                var private_support_key_string = fs.readFileSync('./keys/support/key.pem').toString();
                var public_support_key_string = fs.readFileSync('./keys/support/public.pem').toString();

                var private_support_key = new NodeRSA();
                private_support_key.importKey(private_support_key_string, 'private');

                var public_support_key = new NodeRSA();
                public_support_key.importKey(public_support_key_string, 'public');

                content.support_app_public_key = public_support_key_string.toString();
                content.support_app_signed_nonce = private_support_key.sign(nonce, 'hex', 'utf8').toString();

                console.log(JSON.stringify(content, undefined, 2));

                //create the chain
                var app_chain_ext_id = crypto.createHash('md5').update(util.getSalt() + chain_id).digest('hex');
                console.log('extid: ' + app_chain_ext_id);

                var new_entry0 = Entry.builder()
                    .extId(new Buffer(app_chain_ext_id), 'utf8')
                    .content(JSON.stringify(content), 'utf8')
                    .build();

                console.log(new_entry0);
                console.log(new_entry0.content.toString('utf8'));

                var new_chain = new Chain(new_entry0);

                cli.addChain(new_chain, process.env.FACTOM_EC).then(function (chain) {
                    console.log('Published new support chain!:');
                    console.log(chain)
                    if (callback) callback(undefined, new_entry);
                }).catch(function (err) {
                    console.error(err);
                    if (callback) callback(err);
                    else console.error(err);
                })

        */

    }).catch(function (err) {
        console.error(err);
    })
}

function initContactsChain() {

    var chain_id = 'dbgrow_support';
    var support_chain_id = getContactChainID(chain_id);
    console.log('Checking if chain with id ' + support_chain_id + ' exists');

//check if this chain exists already!
    cli.chainExists(support_chain_id).then(function (exists) {
        if (exists) {
            console.error('Chain already exists! Cannot initialize twice.')
            return;
        }

        console.log('Chain does not exist! Creating:');

        //set the keys for the new support chain's root key.
        // Administrative actions such as adding contact signatures will be authenticated
        // using signed material from this public key's counterpart
        var private_support_key_string = fs.readFileSync('./keys/support/key.pem').toString();
        var public_support_key_string = fs.readFileSync('./keys/support/public.pem').toString();

        //check that these exist!

        var private_support_key = new NodeRSA();
        private_support_key.importKey(private_support_key_string, 'private');

        var public_support_key = new NodeRSA();
        public_support_key.importKey(public_support_key_string, 'public');

        var nonce = crypto.randomBytes(16).toString('hex');

        var signed_nonce = private_support_key.sign(nonce, 'hex', 'utf8').toString();

        //this will be the content of our signed entries!
        var content = {
            type: 'meta',
            support_app_public_key: public_support_key_string.toString(),
            nonce: nonce,
            signed_nonce: signed_nonce,
            message: "This is the beginning of DBGrow's Factom Support contacts chain! Support staff's names/info and signatures will be posted here. Each entry will be signed by the public key in this entry's counterpart"
        };

        console.log(JSON.stringify(content, undefined, 2));

        //create the chain
        var contact_chain_ext_id = crypto.createHash('md5').update(util.getSalt() + 'dbgrow_support:contacts').digest('hex');
        console.log('extid: ' + contact_chain_ext_id);

        var new_entry0 = Entry.builder()
            .extId(new Buffer(contact_chain_ext_id), 'utf8')
            .content(JSON.stringify(content), 'utf8')
            .build();

        console.log(new_entry0);
        console.log(new_entry0.content.toString('utf8'));

        var new_chain = new Chain(new_entry0);

        cli.addChain(new_chain, process.env.FACTOM_EC).then(function (chain) {
            console.log('Published new contacts chain!:');
            console.log(chain)
        }).catch(function (err) {
            console.error(err);
            console.error(err);
        })

    }).catch(function (err) {
        console.error(err);
        if (callback) callback(err);
        else console.error(err);
    })

}

function dispatchNotification(host) {
    if (!host.notify) {
        console.error('Notification to host was ignored!');
        return;
    }

    var html = "";
    html += "DOWN ALERT: " + host.name ? (host.name + host.ip + ':' + host.port) : (host.ip + ':' + host.port);
    html += '\n\n Visit <a href="https://dbgrow.com/checkin/128j89"> here to checkin!</a> ';

    var text = "";
    text += "DOWN ALERT: " + host.name ? (host.name + host.ip + ':' + host.port) : (host.ip + ':' + host.port);
    text += '\n\n Visit https://dbgrow.com/checkin/128j89 here to checkin!';

    contacts.forEach(function (contact) {

        //for each contact, check the last time they were alerted
        if (contact.last_alerted && (new Date().getTime() - contact.last_alerted.getTime()) < alert_max_interval_ms) {
            console.error('Ignored alert since last contacted recently');
            return;
        }

        //send SMS alert
        sendText(contact.phone, text);

        //send email alerts to all emails
        contact.emails.forEach(function (email) {
            sendEmail(email, "DOWN ALERT: " + host.name ? (host.name + host.ip + ':' + host.port) : (host.ip + ':' + host.port), html);
        });

        //call the contact's phone
        sendCall(contact.phone, html);

        contact.last_alerted = new Date();
    });
}

function getContactChainID() {
    // console.log(chain_salt + ' USING SALT');
    return new Chain(Entry.builder()
        .extId(new Buffer(crypto.createHash('md5').update(util.getSalt() + 'dbgrow_support:contacts').digest("hex"), 'utf8'))
        .build()).id.toString('hex')
}

module.exports = {
    init: init,
    dispatchNotification: dispatchNotification,
    getAllContacts: function () {
        return contacts
    },
    initContactsChain: initContactsChain,
    commitAllContacts: commitAllContacts
};