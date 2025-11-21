import json
from models.Customer import Customer
from models.Admin import Admin

class AuthManager:
    """
    Handles:
    - user authentication
    - user registration
    - loading and saving users from JSON file
    """

    def __init__(self, userFilePath="data/users.json"):
        self.userFilePath = userFilePath
        self.users = []   # List of User objects
        self.loadUsers()

    # ---------------------------------------------
    # Load users from JSON storage
    # ---------------------------------------------
    def loadUsers(self):
        """Loads user data and recreates Admin / Customer objects."""
        
        # avoid duplicate loading
        self.users = []   

        try:
            with open(self.userFilePath, "r") as file:
                data = json.load(file)

            for u in data:
                if u.get("isAdmin") is True:
                    obj = Admin(
                        u["userID"], u["username"], u["password"],
                        u["email"], u["fullName"]
                    )
                else:
                    obj = Customer(
                        u["userID"], u["username"], u["password"],
                        u["email"], u["fullName"],
                        u.get("customerType", "Adult")
                    )

                self.users.append(obj)

        except FileNotFoundError:
            self.users = []

    # ---------------------------------------------
    # Save users back into JSON
    # ---------------------------------------------
    def saveUsers(self):
        """Saves all user information into JSON."""
        data = []

        for u in self.users:
            obj = {
                "userID": u.userID,
                "username": u.username,
                "password": u.password,
                "email": u.email,
                "fullName": u.fullName,
                "isAdmin": u.isAdmin
            }

            # Customers only
            if not u.isAdmin:
                obj["customerType"] = u.customerType

            data.append(obj)

        with open(self.userFilePath, "w") as file:
            json.dump(data, file, indent=4)

    # ---------------------------------------------
    # Authentication (Login)
    # ---------------------------------------------
    def authenticate(self, username, password):
        """Returns the user object if credentials are correct."""
        for user in self.users:
            if user.username == username and user.password == password:
                return user
        return None

    # ---------------------------------------------
    # Registration
    # ---------------------------------------------
    def registerUser(self, customer):
        """Registers customer if username is unique."""
        for u in self.users:
            if u.username == customer.username:
                return False  # Duplicate username

        self.users.append(customer)
        self.saveUsers()
        return True
