from models.User import User

class Customer(User):

    # Customer of the theme park system. Can purchase tickets, merchandise, submit reviews, etc.

    def __init__(self, userID, username, password, email, fullName, customerType):
        super().__init__(userID, username, password, email, fullName, isAdmin=False)
        self.customerType = customerType    # e.g. Adult, Child, Senior

    def viewOrders(self, orderList):
       # Returns all orders that belong to this customer.
        return [o for o in orderList if o.customerID == self.userID]
