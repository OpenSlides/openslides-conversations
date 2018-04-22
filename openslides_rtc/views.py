from django.http import HttpResponse
from django.views import View
import json

# information over users of RTC functions
# required for signalling and certain media features

#only provides functions to children.
class RtcAbstractView(View):
    #mark the user as logged in on a given List
    def login(self, list, user_name, user_id):
        list[user_name] = {
            "id": user_id,
            "available": True
        }
    
    #mark the user as logged out
    def logout(self, list, user_name, user_id):
        list[user_name] = {
            "id": user_id,
            "available": False
        }
    
    #sends a user list using the respond function
    def send_list(self, list):
        return self.respond({
            "list": list
        })
    
    #sends a success message using the respond function
    def send_success(self):
        return self.respond({
            "status": "success"
        })

    #converts object to json and returns it
    def respond(self, message):
        return HttpResponse(json.dumps(message))

    #helping function to find the user array
    def pretty_print_user_array(self):
        print("Pretty print the users: \n-----")
        for user in self.private_chat_users:
            print(str(user) + " :: " + str(self.private_chat_users[user]))
        print("----")


#view class for the private chat page
class PrivateConversationView(RtcAbstractView):
    private_chat_users = {}

    def post(self, request):
        request_json = json.loads(request.body)
        user_name = request_json["user_name"]
        user_id = request_json["user_id"]
        action = request_json["action"]

        if (action == "login"):
            self.login(self.private_chat_users, user_name, user_id)
            return self.send_list(self.private_chat_users)

        elif (action == "logout"):
            self.logout(self.private_chat_users, user_name, user_id)
            return self.send_success()
        
        elif (action == "get_users"):
            return self.send_list(self.private_chat_users)


#view class for the group conversations page
class GroupConversationsView(RtcAbstractView):
    #setup channels in server. TODO user might dynamically create channels
    group_discussion_users = {}
    group_channels = {}
    group_channels["Channel 1"] = []
    group_channels["Discussion"] = []
    group_channels["Generally Unused"] = []

    def post(self, request):
        request_json = json.loads(request.body)
        user_name = request_json["user_name"]
        user_id = request_json["user_id"]
        action = request_json["action"]

        if (action == "login"):
            self.login(self.private_chat_users, user_name, user_id)
            return self.send_list(self.group_discussion_users)

        elif (action == "logout"):
            self.logout(self.private_chat_users, user_name, user_id)
            return self.send_success()
        
        elif (action == "get_users"):
            return self.send_list(self.group_discussion_users)
        
        elif (action == "get_channels"):
            return self.send_list(self.group_channels)
        else:
            #assume every ither action is loggin in the user to a channel
            #create a new channel if not there yet
            #would allow user to generate their own channels
            if not action in self.group_channels:
                self.group_channels[action] = []
            user_object = {
                "id": user_id,
                "name": user_name
            }

            #remove user from every other channel
            for channel, key in self.group_channels.items():
                if not channel == action:
                    if user_object in self.group_channels[channel]:
                        self.group_channels[channel].remove(user_object)

            #adds the user to the channel. Remove them if logged in already
            if not user_object in self.group_channels[action]:
                self.group_channels[action].append(user_object)
            else:
                self.group_channels[action].remove(user_object)
            
            return self.send_success()


#view class for the moderated discussion page
class ModeratedDiscussionView(RtcAbstractView):
    moderate_discussion_users = {}
    current_streamer = {
        "id": 0,
        "name": ""
    }

    def post(self, request):
        request_json = json.loads(request.body)
        user_name = request_json["user_name"]
        user_id = request_json["user_id"]
        action = request_json["action"]

        if (action == "login"):
            self.login(self.moderate_discussion_users, user_name, user_id)
            return self.respond(self.current_streamer)

        elif (action == "logout"):
            self.logout(self.moderate_discussion_users, user_name, user_id)
            return self.send_success()
        
        elif (action == "get_users"):
            return self.send_list(self.moderate_discussion_users)
        
        elif (action == "register_stream"):
            self.current_streamer["id"] = user_id
            self.current_streamer["name"] = user_name
            #after register the stream, return the user list
            return self.send_list(self.moderate_discussion_users)