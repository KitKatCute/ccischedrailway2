# Email setup (Forgot password -> temporary password)

"Forgot password" now emails the faculty member a temporary password (valid 30 minutes).
The backend needs an email account/service to send from. Use Option A, Option B, or BOTH
(see "Using both" below), and add the variables in Railway (backend service -> Variables), or in `backend/.env` when running locally.
No new Python packages are needed. The new `users` columns are added automatically at startup.

If email is NOT configured (or sending fails), "Forgot password" falls back to the old
behaviour: a request appears for the chairperson under Faculty -> Password Requests.

## Option A - Brevo (recommended on Railway)
Railway blocks outbound SMTP on its lower plans, so use an HTTPS email API.

1. Create a free account at brevo.com.
2. Senders -> add and verify the address you want emails to come from. It must be an inbox
   you can open to click the verification link (a Gmail you own works).
3. SMTP & API -> API keys -> create a key.
4. Set these variables:

       MAIL_PROVIDER=brevo
       BREVO_API_KEY=xkeysib-...
       MAIL_FROM_EMAIL=the-address-you-verified@gmail.com
       MAIL_FROM_NAME=CCISched

## Option B - Gmail SMTP
Works locally and on Railway plans that allow outbound SMTP.

1. Google Account -> Security -> turn on 2-Step Verification.
2. Security -> App passwords -> create one (16 characters).
3. Set these variables:

       MAIL_PROVIDER=smtp
       SMTP_HOST=smtp.gmail.com
       SMTP_PORT=587
       SMTP_USER=youraddress@gmail.com
       SMTP_PASSWORD=the16characterapppassword
       MAIL_FROM_NAME=CCISched

Gmail allows roughly 500 emails per day, which is plenty for this app.

## Using both (Brevo first, Gmail as backup)
Set the Option A variables AND the Option B variables. Each email is tried through Brevo
first; if Brevo fails (bad key, unverified sender, outage), it is retried through Gmail SMTP.
The chairperson fallback only kicks in if both fail.

- `MAIL_PROVIDER=smtp` flips the order (Gmail first, Brevo as backup).
- Brevo sends from `MAIL_FROM_EMAIL` (must be verified in Brevo). Gmail sends from `SMTP_USER`
  (set `SMTP_FROM_EMAIL` only if you need something different). Using the same Gmail address
  for both keeps the "From" consistent.
- On Railway lower plans the Gmail attempt will time out (SMTP is blocked); that only matters
  if Brevo also fails. Check the logs for `[mailer]` lines to see which provider was used.

## Notes
- Recipients can be on any domain (including @pup.edu.ph). The *sender* address must be one
  you actually control - do not use an @pup.edu.ph sender unless you own that mailbox/domain.
- Some school mail systems send unknown senders to Spam. Test with a real @pup.edu.ph address.
- Temporary password: 30 minutes, one email per person every 2 minutes, 10 requests per IP per hour.
- Faculty emails in the database must be real, working addresses.

## Quick test
Faculty login page -> "Forgot password?" -> enter a faculty email -> check the inbox
-> log in with the temporary password -> you are asked to set a new password.
