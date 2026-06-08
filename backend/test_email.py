import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

# ─── FILL THESE IN ───────────────────────────────────────────────────
SENDER_EMAIL    = "paco636387@gmail.com"       # e.g. john@gmail.com
SENDER_PASSWORD = "udct gklk fmaw jhhh"          # 16-char app password e.g. abcd efgh ijkl mnop
TEST_TO_EMAIL   = "paco636387@gmail.com"       # send test to yourself
# ─────────────────────────────────────────────────────────────────────

print("=" * 50)
print("CloudScope Email Tester")
print("=" * 50)
print(f"Sending FROM : {SENDER_EMAIL}")
print(f"Sending TO   : {TEST_TO_EMAIL}")
print("Connecting to Gmail SMTP...")

try:
    msg = MIMEMultipart("alternative")
    msg["Subject"] = "✅ CloudScope Email Test"
    msg["From"]    = SENDER_EMAIL
    msg["To"]      = TEST_TO_EMAIL
    msg.attach(MIMEText("<h2 style='color:green'>✅ Email is working!</h2><p>Your CloudScope email setup is correct.</p>", "html"))

    with smtplib.SMTP_SSL("smtp.gmail.com", 465) as server:
        print("Connected! Logging in...")
        server.login(SENDER_EMAIL, SENDER_PASSWORD)
        print("Login successful! Sending email...")
        server.sendmail(SENDER_EMAIL, TEST_TO_EMAIL, msg.as_string())

    print("\n✅ SUCCESS! Email sent. Check your inbox.")

except smtplib.SMTPAuthenticationError:
    print("\n❌ ERROR: Authentication Failed!")
    print("   → Your Gmail or App Password is wrong.")
    print("   → Make sure you're using an APP PASSWORD, not your real Gmail password.")
    print("   → Get it from: https://myaccount.google.com/apppasswords")

except smtplib.SMTPException as e:
    print(f"\n❌ SMTP Error: {e}")

except Exception as e:
    print(f"\n❌ Unknown Error: {e}")