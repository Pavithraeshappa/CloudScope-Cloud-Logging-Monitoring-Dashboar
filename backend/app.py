from flask import Flask, jsonify, request
from flask_cors import CORS
import random, time, threading, datetime, psutil, smtplib, hashlib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from pymongo import MongoClient
from bson import ObjectId

app = Flask(__name__)
CORS(app)

# ─── MongoDB Connection ─────────────────────────────────────────────
MONGO_URI = "mongodb://localhost:27017/"   # ← Local MongoDB
client     = MongoClient(MONGO_URI)
db         = client["cloudscope"]          # ← Database name: cloudscope

# ─── Collections (like tables in MySQL) ────────────────────────────
users_col    = db["users"]          # stores user accounts
logs_col     = db["logs"]           # stores all logs
alerts_col   = db["alerts"]         # stores all alerts
metrics_col  = db["metrics"]        # stores CPU/memory history
blocked_col  = db["blocked"]        # stores blocked accounts
history_col  = db["login_history"]  # stores login attempts
email_col    = db["email_logs"]     # stores email logs
attempts_col = db["failed_attempts"]# stores wrong password counts

print("✅ Connected to MongoDB successfully!")

# ─── Config ────────────────────────────────────────────────────────
MAX_FAILED = 3
SENDER_EMAIL    = "paco636387@gmail.com"    # ← the one that worked
SENDER_PASSWORD = "udct gklk fmaw jhhh"  # ← same app password you just used
ADMIN_EMAIL     = "paco636387@gmail.com"    # ← or any email you want alerts sent to

SERVICES = ["auth-service","api-gateway","database","cache","payment-service","user-service"]
LOG_LEVELS = ["INFO","WARNING","ERROR","DEBUG"]
LOG_LEVEL_WEIGHTS = [60,20,10,10]
LOG_MESSAGES = {
    "INFO":    ["Request processed successfully","Cache hit for key: session_{}","Service health check passed","Database query completed in {}ms","API response sent with status 200"],
    "WARNING": ["High memory usage: {}%","Slow query detected: {}ms","Retry attempt {} for failed request","Rate limit approaching for IP: 192.168.1.{}"],
    "ERROR":   ["Database connection failed","Unhandled exception in payment-service","Authentication token expired","Timeout after {}ms waiting for response"],
    "DEBUG":   ["Processing request ID: {}","Cache key: session_{} TTL: {}s","Thread {} started","Entering function: handle_request()"],
}

# ─── Helpers ───────────────────────────────────────────────────────
def now():
    return datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")

def hash_password(password):
    return hashlib.sha256(password.encode()).hexdigest()

def fix_id(doc):
    """Convert MongoDB _id to string so React can read it"""
    if doc and "_id" in doc:
        doc["_id"] = str(doc["_id"])
    return doc

def add_log(level, service, message):
    logs_col.insert_one({"timestamp": now(), "level": level, "service": service, "message": message})
    # Keep only last 200 logs
    count = logs_col.count_documents({})
    if count > 200:
        oldest = list(logs_col.find().sort("_id", 1).limit(count - 200))
        ids = [d["_id"] for d in oldest]
        logs_col.delete_many({"_id": {"$in": ids}})

def add_alert(alert_type, title, message):
    alerts_col.insert_one({"type": alert_type, "title": title, "message": message, "timestamp": now(), "resolved": False})

# ─── Email Functions ────────────────────────────────────────────────
def send_email(to_email, subject, html_body):
    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"]    = f"CloudScope Security <{SENDER_EMAIL}>"
        msg["To"]      = to_email
        msg.attach(MIMEText(html_body, "html"))
        with smtplib.SMTP_SSL("smtp.gmail.com", 465) as server:
            server.login(SENDER_EMAIL, SENDER_PASSWORD)
            server.sendmail(SENDER_EMAIL, to_email, msg.as_string())
        email_col.insert_one({"timestamp": now(), "to": to_email, "subject": subject, "status": "SENT"})
        add_log("INFO", "email-service", f"Email SENT to {to_email} | {subject}")
        return True
    except Exception as e:
        email_col.insert_one({"timestamp": now(), "to": to_email, "subject": subject, "status": "FAILED", "error": str(e)})
        add_log("ERROR", "email-service", f"Email FAILED to {to_email} | Error: {str(e)}")
        return False

def _base_template(title, header_color, icon, content_html):
    return f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1.0"/>
  <title>{title}</title>
</head>
<body style="margin:0;padding:0;background:#f0f2f5;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0f2f5;padding:32px 0;">
    <tr><td align="center">
      <table width="580" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.10);">
        <!-- Header -->
        <tr>
          <td style="background:{header_color};padding:32px 40px;text-align:center;">
            <div style="font-size:48px;margin-bottom:10px;">{icon}</div>
            <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700;letter-spacing:0.5px;">{title}</h1>
            <p style="margin:6px 0 0;color:rgba(255,255,255,0.85);font-size:13px;">CloudScope Security System</p>
          </td>
        </tr>
        <!-- Body -->
        <tr>
          <td style="padding:36px 40px;">
            {content_html}
          </td>
        </tr>
        <!-- Footer -->
        <tr>
          <td style="background:#f8f9fb;padding:20px 40px;text-align:center;border-top:1px solid #e9ecef;">
            <p style="margin:0;color:#9aa0ac;font-size:12px;">This is an automated security message from <strong>CloudScope</strong>.<br/>
            Do not reply to this email. For support, contact your administrator.</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>"""

def send_warning_email(name, email, attempt, remaining):
    subject = f"⚠️ Security Alert: Failed Login Attempt ({attempt}/{MAX_FAILED})"
    bar_width = int((attempt / MAX_FAILED) * 100)
    bar_color = "#f59e0b" if remaining > 1 else "#ef4444"
    content = f"""
      <p style="margin:0 0 20px;color:#374151;font-size:16px;">Hi <strong>{name}</strong>,</p>
      <p style="margin:0 0 24px;color:#6b7280;font-size:15px;line-height:1.6;">
        We detected a <strong style="color:#ef4444;">failed login attempt</strong> on your CloudScope account.
        If this wasn't you, please contact your administrator immediately.
      </p>

      <!-- Attempt Progress Bar -->
      <div style="background:#f3f4f6;border-radius:8px;padding:20px;margin-bottom:24px;">
        <p style="margin:0 0 10px;color:#374151;font-size:13px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">Attempt Progress</p>
        <div style="background:#e5e7eb;border-radius:999px;height:12px;overflow:hidden;margin-bottom:8px;">
          <div style="background:{bar_color};height:100%;width:{bar_width}%;border-radius:999px;transition:width 0.3s;"></div>
        </div>
        <p style="margin:0;color:{bar_color};font-size:13px;font-weight:700;">{attempt} of {MAX_FAILED} attempts used</p>
      </div>

      <!-- Info Cards -->
      <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
        <tr>
          <td width="48%" style="background:#fef3c7;border-radius:8px;padding:16px;text-align:center;">
            <p style="margin:0 0 4px;color:#92400e;font-size:12px;font-weight:600;text-transform:uppercase;">Remaining Chances</p>
            <p style="margin:0;color:#d97706;font-size:28px;font-weight:800;">{remaining}</p>
          </td>
          <td width="4%"></td>
          <td width="48%" style="background:#f3f4f6;border-radius:8px;padding:16px;text-align:center;">
            <p style="margin:0 0 4px;color:#6b7280;font-size:12px;font-weight:600;text-transform:uppercase;">Time of Attempt</p>
            <p style="margin:0;color:#374151;font-size:13px;font-weight:700;">{now()}</p>
          </td>
        </tr>
      </table>

      <!-- Warning Box -->
      <div style="background:#fef2f2;border-left:4px solid #ef4444;border-radius:4px;padding:16px;margin-bottom:24px;">
        <p style="margin:0;color:#991b1b;font-size:14px;line-height:1.6;">
          ⚠️ <strong>Warning:</strong> After <strong>{remaining}</strong> more wrong attempt(s), your account will be
          <strong>PERMANENTLY BLOCKED</strong> and can only be restored by the admin.
        </p>
      </div>

      <p style="margin:0;color:#9ca3af;font-size:13px;">
        If you made this attempt, please double-check your password. Otherwise, contact support right away.
      </p>"""
    html = _base_template("⚠️ Failed Login Attempt", "linear-gradient(135deg,#f59e0b,#ef4444)", "🔐", content)
    threading.Thread(target=send_email, args=(email, subject, html), daemon=True).start()

def send_blocked_email(name, email):
    subject = "🚫 Your Account Has Been Permanently Blocked"
    content = f"""
      <p style="margin:0 0 20px;color:#374151;font-size:16px;">Hi <strong>{name}</strong>,</p>
      <p style="margin:0 0 24px;color:#6b7280;font-size:15px;line-height:1.6;">
        Your CloudScope account has been <strong style="color:#ef4444;">permanently blocked</strong>
        after <strong>{MAX_FAILED}</strong> consecutive failed login attempts.
      </p>

      <!-- Blocked Banner -->
      <div style="background:#fef2f2;border:2px solid #fca5a5;border-radius:10px;padding:24px;text-align:center;margin-bottom:24px;">
        <div style="font-size:48px;margin-bottom:8px;">🚫</div>
        <p style="margin:0 0 6px;color:#991b1b;font-size:18px;font-weight:800;">Account Blocked</p>
        <p style="margin:0;color:#ef4444;font-size:13px;">Blocked at: <strong>{now()}</strong></p>
      </div>

      <!-- Details Table -->
      <table width="100%" cellpadding="0" cellspacing="8" style="margin-bottom:24px;">
        <tr>
          <td style="background:#f9fafb;border-radius:6px;padding:12px 16px;color:#6b7280;font-size:13px;font-weight:600;">Account</td>
          <td style="background:#f9fafb;border-radius:6px;padding:12px 16px;color:#374151;font-size:13px;">{email}</td>
        </tr>
        <tr><td colspan="2" style="padding:4px 0;"></td></tr>
        <tr>
          <td style="background:#f9fafb;border-radius:6px;padding:12px 16px;color:#6b7280;font-size:13px;font-weight:600;">Reason</td>
          <td style="background:#f9fafb;border-radius:6px;padding:12px 16px;color:#374151;font-size:13px;">{MAX_FAILED} consecutive wrong password attempts</td>
        </tr>
        <tr><td colspan="2" style="padding:4px 0;"></td></tr>
        <tr>
          <td style="background:#f9fafb;border-radius:6px;padding:12px 16px;color:#6b7280;font-size:13px;font-weight:600;">Status</td>
          <td style="background:#fef2f2;border-radius:6px;padding:12px 16px;color:#ef4444;font-size:13px;font-weight:700;">PERMANENTLY BLOCKED</td>
        </tr>
      </table>

      <!-- Action Required -->
      <div style="background:#eff6ff;border-left:4px solid #3b82f6;border-radius:4px;padding:16px;margin-bottom:24px;">
        <p style="margin:0;color:#1e40af;font-size:14px;line-height:1.6;">
          ℹ️ <strong>What to do next:</strong> Your account will remain blocked until an administrator manually unblocks it.
          Please contact your admin and provide your email address.
        </p>
      </div>

      <p style="margin:0;color:#9ca3af;font-size:13px;">
        If you did not make these login attempts, your credentials may be compromised. Contact support immediately.
      </p>"""
    html = _base_template("Account Permanently Blocked", "linear-gradient(135deg,#dc2626,#991b1b)", "🚫", content)
    threading.Thread(target=send_email, args=(email, subject, html), daemon=True).start()

def send_admin_email(name, email):
    subject = "🚨 CRITICAL: Brute Force Attack Detected!"
    content = f"""
      <p style="margin:0 0 20px;color:#374151;font-size:16px;">Hello <strong>Admin</strong>,</p>
      <p style="margin:0 0 24px;color:#6b7280;font-size:15px;line-height:1.6;">
        A <strong style="color:#ef4444;">brute force attack</strong> was detected and the account has been automatically blocked.
        Immediate review is recommended.
      </p>

      <!-- Alert Box -->
      <div style="background:#fef2f2;border:2px solid #fca5a5;border-radius:10px;padding:20px;margin-bottom:24px;text-align:center;">
        <p style="margin:0 0 4px;color:#991b1b;font-size:16px;font-weight:800;">🔴 SECURITY INCIDENT DETECTED</p>
        <p style="margin:0;color:#ef4444;font-size:13px;">{now()}</p>
      </div>

      <!-- Incident Details -->
      <table width="100%" cellpadding="0" cellspacing="8" style="margin-bottom:24px;">
        <tr>
          <td style="background:#f9fafb;border-radius:6px;padding:12px 16px;color:#6b7280;font-size:13px;font-weight:600;width:40%;">Customer Name</td>
          <td style="background:#f9fafb;border-radius:6px;padding:12px 16px;color:#374151;font-size:13px;">{name}</td>
        </tr>
        <tr><td colspan="2" style="padding:4px 0;"></td></tr>
        <tr>
          <td style="background:#f9fafb;border-radius:6px;padding:12px 16px;color:#6b7280;font-size:13px;font-weight:600;">Customer Email</td>
          <td style="background:#f9fafb;border-radius:6px;padding:12px 16px;color:#374151;font-size:13px;">{email}</td>
        </tr>
        <tr><td colspan="2" style="padding:4px 0;"></td></tr>
        <tr>
          <td style="background:#f9fafb;border-radius:6px;padding:12px 16px;color:#6b7280;font-size:13px;font-weight:600;">Failed Attempts</td>
          <td style="background:#fef2f2;border-radius:6px;padding:12px 16px;color:#ef4444;font-size:13px;font-weight:700;">{MAX_FAILED} / {MAX_FAILED}</td>
        </tr>
        <tr><td colspan="2" style="padding:4px 0;"></td></tr>
        <tr>
          <td style="background:#f9fafb;border-radius:6px;padding:12px 16px;color:#6b7280;font-size:13px;font-weight:600;">Action Taken</td>
          <td style="background:#fef2f2;border-radius:6px;padding:12px 16px;color:#ef4444;font-size:13px;font-weight:700;">Account PERMANENTLY BLOCKED</td>
        </tr>
      </table>

      <div style="text-align:center;margin-bottom:24px;">
        <a href="http://localhost:5173" style="display:inline-block;background:#3b82f6;color:#fff;text-decoration:none;padding:14px 32px;border-radius:8px;font-size:14px;font-weight:700;">
          Open Admin Dashboard →
        </a>
      </div>

      <p style="margin:0;color:#9ca3af;font-size:13px;">
        You can unblock this account from the Blocked Accounts section of your dashboard.
      </p>"""
    html = _base_template("🚨 Brute Force Attack Detected", "linear-gradient(135deg,#7c3aed,#dc2626)", "🚨", content)
    threading.Thread(target=send_email, args=(ADMIN_EMAIL, subject, html), daemon=True).start()

def send_signup_welcome_email(name, email):
    subject = "🎉 Welcome to CloudScope!"
    content = f"""
      <p style="margin:0 0 20px;color:#374151;font-size:16px;">Hi <strong>{name}</strong>, welcome aboard! 🎉</p>
      <p style="margin:0 0 24px;color:#6b7280;font-size:15px;line-height:1.6;">
        Your CloudScope account has been successfully created. You can now log in and start monitoring your cloud infrastructure.
      </p>
      <table width="100%" cellpadding="0" cellspacing="8" style="margin-bottom:24px;">
        <tr>
          <td style="background:#f9fafb;border-radius:6px;padding:12px 16px;color:#6b7280;font-size:13px;font-weight:600;width:40%;">Email</td>
          <td style="background:#f9fafb;border-radius:6px;padding:12px 16px;color:#374151;font-size:13px;">{email}</td>
        </tr>
        <tr><td colspan="2" style="padding:4px 0;"></td></tr>
        <tr>
          <td style="background:#f9fafb;border-radius:6px;padding:12px 16px;color:#6b7280;font-size:13px;font-weight:600;">Joined At</td>
          <td style="background:#f9fafb;border-radius:6px;padding:12px 16px;color:#374151;font-size:13px;">{now()}</td>
        </tr>
      </table>
      <div style="text-align:center;">
        <a href="http://localhost:5173" style="display:inline-block;background:#10b981;color:#fff;text-decoration:none;padding:14px 32px;border-radius:8px;font-size:14px;font-weight:700;">
          Go to Dashboard →
        </a>
      </div>"""
    html = _base_template("Welcome to CloudScope!", "linear-gradient(135deg,#10b981,#3b82f6)", "🎉", content)
    threading.Thread(target=send_email, args=(email, subject, html), daemon=True).start()

# ─── Background Generator ──────────────────────────────────────────
def generate_log():
    level   = random.choices(LOG_LEVELS, weights=LOG_LEVEL_WEIGHTS)[0]
    service = random.choice(SERVICES)
    msg     = random.choice(LOG_MESSAGES[level]).format(
        random.randint(1,999), random.randint(10,5000), random.randint(1,100)
    )
    add_log(level, service, msg)

def background_generator():
    while True:
        for _ in range(random.randint(1, 3)):
            generate_log()

        try:
            cpu    = psutil.cpu_percent(interval=None)
            memory = psutil.virtual_memory().percent
            disk   = psutil.disk_usage('/').percent
        except:
            cpu = random.uniform(20,95)
            memory = random.uniform(40,90)
            disk = random.uniform(30,80)

        recent_logs  = list(logs_col.find().sort("_id", -1).limit(20))
        error_count  = sum(1 for l in recent_logs if l["level"] == "ERROR")
        total_recent = len(recent_logs)
        error_rate   = round((error_count / total_recent) * 100, 1) if total_recent > 0 else 0

        metric = {
            "timestamp":          datetime.datetime.now().strftime("%H:%M:%S"),
            "cpu":                round(cpu, 1),
            "memory":             round(memory, 1),
            "disk":               round(disk, 1),
            "network_mb":         round(random.uniform(10, 100), 2),
            "requests_per_sec":   random.randint(10, 300),
            "error_rate":         error_rate,
            "active_connections": random.randint(5, 200),
        }
        metrics_col.insert_one(metric)
        # Keep only last 20 metrics
        count = metrics_col.count_documents({})
        if count > 20:
            oldest = list(metrics_col.find().sort("_id", 1).limit(count - 20))
            ids = [d["_id"] for d in oldest]
            metrics_col.delete_many({"_id": {"$in": ids}})

        if metric["cpu"] > 85:
            add_alert("CRITICAL", "High CPU Usage",    f"CPU at {metric['cpu']}% — exceeds 85%")
        if metric["memory"] > 80:
            add_alert("WARNING",  "High Memory Usage", f"Memory at {metric['memory']}% — exceeds 80%")
        if metric["error_rate"] > 10:
            add_alert("CRITICAL", "High Error Rate",   f"Error rate at {metric['error_rate']}% — exceeds 10%")

        time.sleep(1)

# ─── AUTH ROUTES ───────────────────────────────────────────────────

@app.route("/api/signup", methods=["POST"])
def signup():
    data     = request.get_json()
    name     = data.get("name","").strip()
    email    = data.get("email","").strip().lower()
    password = data.get("password","").strip()

    if not name or not email or not password:
        return jsonify({"success": False, "message": "All fields are required!"}), 400
    if users_col.find_one({"email": email}):
        return jsonify({"success": False, "message": "Email already registered! Please login."}), 400
    if len(password) < 6:
        return jsonify({"success": False, "message": "Password must be at least 6 characters!"}), 400

    users_col.insert_one({
        "name":          name,
        "email":         email,
        "password_hash": hash_password(password),
        "created_at":    now(),
    })

    add_log("INFO", "auth-service", f"New user registered: '{name}' | Email: {email}")
    add_alert("INFO", "New User Registered", f"'{name}' ({email}) created an account successfully.")
    send_signup_welcome_email(name, email)

    return jsonify({"success": True, "message": f"Account created! Welcome {name}."})


@app.route("/api/login", methods=["POST"])
def login():
    data      = request.get_json()
    email     = data.get("email","").strip().lower()
    password  = data.get("password","").strip()
    timestamp = now()

    user = users_col.find_one({"email": email})
    if not user:
        add_log("WARNING","auth-service",f"Login attempt for non-existent email: {email}")
        return jsonify({"success": False, "message": "No account found with this email. Please sign up first!"}), 404

    name = user["name"]

    # Check permanently blocked
    if blocked_col.find_one({"email": email}):
        add_log("ERROR","auth-service",f"BLOCKED login attempt | Email:{email}")
        history_col.insert_one({"timestamp":timestamp,"name":name,"email":email,"status":"BLOCKED","message":"Account permanently blocked. Contact admin."})
        return jsonify({"success":False,"status":"BLOCKED","message":"🚫 Your account is permanently blocked! Please contact the admin to unblock your account."}),403

    if user["password_hash"] == hash_password(password):
        # ✅ Correct password
        attempts_col.delete_one({"email": email})
        add_log("INFO","auth-service",f"SUCCESS: '{name}' logged in | Email:{email}")
        history_col.insert_one({"timestamp":timestamp,"name":name,"email":email,"status":"SUCCESS","message":"Login successful"})
        return jsonify({"success":True,"status":"SUCCESS","message":f"Welcome back {name}!","user":{"name":name,"email":email}})

    else:
        # ❌ Wrong password
        fa    = attempts_col.find_one({"email": email})
        count = (fa["count"] if fa else 0) + 1
        attempts_col.update_one({"email": email}, {"$set": {"count": count}}, upsert=True)
        remaining = MAX_FAILED - count

        add_log("WARNING" if count < MAX_FAILED else "ERROR","auth-service",
            f"FAILED LOGIN {count}/{MAX_FAILED} | '{name}' | Email:{email}")
        history_col.insert_one({"timestamp":timestamp,"name":name,"email":email,"status":"FAILED","message":f"Wrong password. Attempt {count}/{MAX_FAILED}"})

        send_warning_email(name, email, count, remaining)

        if count >= MAX_FAILED:
            # 🚫 Permanently block — save to MongoDB
            blocked_col.insert_one({"email":email,"name":name,"blocked_at":now(),"reason":"Too many failed login attempts"})
            attempts_col.delete_one({"email": email})

            add_alert("CRITICAL","Brute Force Attack Detected!",
                f"Account '{name}' ({email}) PERMANENTLY BLOCKED after {MAX_FAILED} failed attempts!")
            add_log("ERROR","auth-service",    f"ACCOUNT BLOCKED | '{name}' | Email:{email}")
            add_log("ERROR","security-monitor",f"SECURITY ALERT: Brute force on '{name}' ({email})")

            send_blocked_email(name, email)
            send_admin_email(name, email)

            return jsonify({
                "success":False,"status":"BLOCKED",
                "message":f"Too many wrong attempts! Your account is PERMANENTLY BLOCKED. Only the admin can unblock it. Alert sent to {email} and admin!",
                "blocked":True
            }),403

        return jsonify({
            "success":False,"status":"FAILED",
            "message":f"Wrong password! {remaining} attempt(s) remaining before permanent block. Warning email sent to {email}.",
            "attempts":count,"remaining_attempts":remaining
        }),401


@app.route("/api/users")
def get_users():
    users = list(users_col.find({}, {"password_hash": 0}))
    for u in users: fix_id(u)
    return jsonify({"users": users, "total": len(users)})

@app.route("/api/login/history")
def get_login_history():
    history = list(history_col.find().sort("_id", -1).limit(30))
    for h in history: fix_id(h)
    return jsonify({"history": history})

@app.route("/api/blocked-accounts")
def get_blocked():
    blocked = list(blocked_col.find())
    for b in blocked:
        fix_id(b)
        b["active"] = True
    return jsonify({"blocked": blocked})

@app.route("/api/unblock/<path:email>", methods=["POST"])
def unblock(email):
    result = blocked_col.find_one({"email": email})
    if result:
        name = result["name"]
        blocked_col.delete_one({"email": email})
        attempts_col.delete_one({"email": email})
        add_log("INFO","auth-service",f"Admin unblocked account: '{name}' ({email})")
        add_alert("INFO","Account Unblocked by Admin",f"Admin unblocked '{name}' ({email})")
        return jsonify({"success":True,"message":f"Account {email} unblocked."})
    return jsonify({"success":False,"message":"Account not found"}),404

@app.route("/api/email-logs")
def get_email_logs():
    logs = list(email_col.find().sort("_id", -1).limit(20))
    for l in logs: fix_id(l)
    return jsonify({"email_logs": logs})

# ─── Monitoring Routes ──────────────────────────────────────────────
@app.route("/api/logs")
def get_logs():
    logs = list(logs_col.find().sort("_id", -1).limit(50))
    for l in logs: fix_id(l)
    return jsonify({"logs": logs, "total": logs_col.count_documents({})})

@app.route("/api/metrics")
def get_metrics():
    history = list(metrics_col.find().sort("_id", -1).limit(20))
    for m in history: fix_id(m)
    history.reverse()
    current = history[-1] if history else {}
    return jsonify({"current": current, "history": history})

@app.route("/api/alerts")
def get_alerts():
    alerts = list(alerts_col.find().sort("_id", -1).limit(20))
    for a in alerts:
        fix_id(a)
        a["id"] = a["_id"]
    return jsonify({"alerts": alerts, "total": alerts_col.count_documents({})})

@app.route("/api/alerts/<string:alert_id>/resolve", methods=["POST"])
def resolve_alert(alert_id):
    try:
        alerts_col.update_one({"_id": ObjectId(alert_id)}, {"$set": {"resolved": True}})
        return jsonify({"success": True})
    except:
        return jsonify({"success": False}), 404

@app.route("/api/health")
def health():
    latest     = metrics_col.find_one(sort=[("_id", -1)]) or {}
    cpu        = latest.get("cpu", 0)
    memory     = latest.get("memory", 0)
    error_rate = latest.get("error_rate", 0)
    status     = "CRITICAL" if (cpu>85 or memory>85 or error_rate>10) else "WARNING" if (cpu>70 or memory>70 or error_rate>5) else "HEALTHY"
    return jsonify({
        "status":        status,
        "uptime":        "99.98%",
        "total_logs":    logs_col.count_documents({}),
        "active_alerts": alerts_col.count_documents({"resolved": False}),
        "total_users":   users_col.count_documents({}),
        "services":      {s: random.choice(["UP","UP","UP","DEGRADED"]) for s in SERVICES}
    })

@app.route("/api/summary")
def summary():
    lc = {"INFO":0,"WARNING":0,"ERROR":0,"DEBUG":0}
    for level in lc:
        lc[level] = logs_col.count_documents({"level": level})
    return jsonify({"log_counts": lc, "total": logs_col.count_documents({})})


# ─── Pre-load default users (only added once, not on every restart) ─
default_users = [
    {"name":"Admin",   "email":"admin@gmail.com",   "password":"admin123"},
    {"name":"John",    "email":"john@gmail.com",    "password":"john456"},
    {"name":"Priya",   "email":"priya@gmail.com",   "password":"priya789"},
    {"name":"Student", "email":"student@gmail.com", "password":"mmc452"},
]
for u in default_users:
    if not users_col.find_one({"email": u["email"]}):
        users_col.insert_one({
            "name":          u["name"],
            "email":         u["email"],
            "password_hash": hash_password(u["password"]),
            "created_at":    now(),
        })
        print(f"✅ Added default user: {u['email']}")

if __name__ == "__main__":
    t = threading.Thread(target=background_generator, daemon=True)
    t.start()
    print("✅ CloudScope Backend running at http://localhost:5000")
    print("🗄️  MongoDB connected — all data saved permanently!")
    print("👤 Login: admin@gmail.com / admin123")
    app.run(debug=False, port=5000)