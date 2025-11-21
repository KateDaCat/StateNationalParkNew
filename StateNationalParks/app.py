from flask import Flask, render_template, request, redirect, session
from models.AuthManager import AuthManager
from controllers.SystemController import SystemController

app = Flask(__name__)
app.secret_key = "secret123"   # Needed for login session

auth = AuthManager()
system = SystemController()

# ============================================================
# HOME PAGE
# ============================================================
@app.route("/")
def home():
    return render_template("home.html")

# ============================================================
# LOGIN PAGE
# ============================================================
@app.route("/login", methods=["GET", "POST"])
def login():
    if request.method == "POST":
        username = request.form["username"]
        password = request.form["password"]

        user = auth.authenticate(username, password)

        if user:
            session["userID"] = user.userID
            session["username"] = user.username
            session["isAdmin"] = user.isAdmin
            return redirect("/dashboard")
        else:
            return render_template("login.html", error="Invalid username or password")

    return render_template("login.html")

# ============================================================
# REGISTER PAGE
# ============================================================
@app.route("/register", methods=["GET", "POST"])
def register():
    if request.method == "POST":
        userID = f"U{len(auth.users)+1}"
        username = request.form["username"]
        password = request.form["password"]
        email = request.form["email"]
        fullName = request.form["fullName"]
        customerType = request.form["customerType"]

        from models.Customer import Customer
        customer = Customer(userID, username, password, email, fullName, customerType)

        if auth.registerUser(customer):
            return redirect("/login")
        else:
            return render_template("register.html", error="Username already exists")

    return render_template("register.html")

# ============================================================
# DASHBOARD
# ============================================================
@app.route("/dashboard")
def dashboard():
    if "username" not in session:
        return redirect("/login")

    return render_template("dashboard.html",
                           username=session["username"],
                           isAdmin=session["isAdmin"])

# ============================================================
# PURCHASE TICKET
# ============================================================
@app.route("/purchase_ticket", methods=["GET", "POST"])
def purchase_ticket():
    if "username" not in session:
        return redirect("/login")

    if request.method == "POST":
        ticketName = request.form["ticketName"]
        price = float(request.form["price"])
        qty = int(request.form["qty"])
        visitDate = request.form["visitDate"]
        parkName = request.form["parkName"]

        ticketData = {
            "ticketName": ticketName,
            "price": price,
            "qty": qty,
            "visitDate": visitDate,
            "parkName": parkName
        }

        # find customer object
        currentUser = next(u for u in auth.users if u.userID == session["userID"])

        system.purchaseTicket(currentUser, ticketData)
        return render_template("purchase_ticket.html", success=True)

    return render_template("purchase_ticket.html")

# ============================================================
# PURCHASE MERCHANDISE
# ============================================================
@app.route("/purchase_merch", methods=["GET", "POST"])
def purchase_merch():
    if "username" not in session:
        return redirect("/login")

    if request.method == "POST":
        merchData = {
            "name": request.form["name"],
            "price": float(request.form["price"]),
            "qty": int(request.form["qty"]),
            "category": request.form["category"],
            "stock": int(request.form["stock"])
        }

        currentUser = next(u for u in auth.users if u.userID == session["userID"])

        system.purchaseMerch(currentUser, merchData)
        return render_template("purchase_merch.html", success=True)

    return render_template("purchase_merch.html")

# ============================================================
# CANCEL TICKET (REPLACES REFUND)
# ============================================================
@app.route("/cancel_ticket", methods=["GET", "POST"])
def cancel_ticket():
    if "username" not in session:
        return redirect("/login")

    if request.method == "POST":
        orderID = request.form["orderID"]
        itemID = request.form["itemID"]

        if system.cancelTicket(orderID, itemID):
            return render_template("cancel_ticket.html", success=True)
        else:
            return render_template("cancel_ticket.html", error="Order not found.")

    return render_template("cancel_ticket.html")

# ============================================================
# REVIEW SUBMISSION
# ============================================================
@app.route("/review", methods=["GET", "POST"])
def review():
    if "username" not in session:
        return redirect("/login")

    if request.method == "POST":
        reviewData = {
            "customerID": session["userID"],
            "rating": int(request.form["rating"]),
            "comment": request.form["comment"]
        }
        system.submitReview(reviewData)
        return render_template("review.html", success=True)

    return render_template("review.html")

# ============================================================
# LOGOUT
# ============================================================
@app.route("/logout")
def logout():
    session.clear()
    return redirect("/")

# ============================================================
# RUN APP
# ============================================================
if __name__ == "__main__":
    app.run(debug=True)
