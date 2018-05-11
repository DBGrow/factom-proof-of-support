### Generate Organization Administrator Keys

Directory `factom-proof-of-support/keys/support`  holds the cryptographic root keys for your organization. These keys will be used to generate the application's chains and add new contacts. This repo will not come with these, so you must generate them yourself before your first run. Keep track of these keys or you will not be able to add new support team members!

**Generate the keys:**

```bash
cd keys/support/
openssl genrsa -out key.pem 2048
openssl rsa -in key.pem -outform PEM -pubout -out public.pem
```

