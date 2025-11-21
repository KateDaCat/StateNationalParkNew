from abc import ABC, abstractmethod

class User(ABC):
    
    # Abstract base class for all system users. Parent of Customer and Admin.
  
    def __init__(self, userID, username, password, email, fullName, isAdmin):
        # Basic identity info common to all users
        self.userID = userID
        self.username = username
        self.password = password
        self.email = email
        self.fullName = fullName
        self.isAdmin = isAdmin

    def signIn(self, password):
        # Validates login by checking the provided password. Returns True if correct.
        return self.password == password

    def signOut(self):
        # Logs user out (placeholder).
        return True
