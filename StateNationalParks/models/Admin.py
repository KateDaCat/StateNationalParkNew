from models.User import User

class Admin(User):

    # Admin responsible for moderating reviews and viewing all orders.
 
    def __init__(self, userID, username, password, email, fullName):
        super().__init__(userID, username, password, email, fullName, isAdmin=True)

    def moderateReview(self, review):
        # Admin can apply moderation tags or content filtering.
        review.comment = "[MODERATED] " + review.comment

    def viewAllOrders(self, orderList):
        return orderList