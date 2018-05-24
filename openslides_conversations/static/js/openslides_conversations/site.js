(function () {

'use strict';

angular.module('OpenSlidesApp.openslides_conversations.site', [
    'OpenSlidesApp.openslides_conversations',
    'OpenSlidesApp.openslides_conversations.templates',
    'OpenSlidesApp.openslides_conversations.templatehooks',
])

.config([
    'mainMenuProvider',
    'gettext',
    function (mainMenuProvider, gettext) {
        mainMenuProvider.register({
            'ui_sref': 'openslides_conversations_moderated',
            'img_class': 'comments',
            'title': gettext('Conversations'),
            'weight': 5000,
            'perm': 'openslides_conversations.can_use_conversations',
        });
    }
])

// register RtcClients on the OpenSlides Server
// also returns RtcUsers from the Server
.factory('RtcRegister', [
    '$http',
    'operator',
    function($http, operator) {

        //returns a generic object used in every post requests
        function getPostObject(actionName) {
            return {
                user_name: operator.user.username,
                user_id: operator.user.id,
                action: actionName
            }
        }

        //register a rtc client
        function rtcLogin(view) {
            return $http.post('/rtc/' + view +'/', getPostObject("login"));
        }

        //get the user list from the server
        function getRtcUserList(view) {
            return $http.post('/rtc/' + view +'/', getPostObject("get_users"));
        }

        //returns the group channels
        function getGroupChannels() {
            return $http.post('/rtc/group_conversations/', getPostObject("get_channels"));
        }

        function switchChannel(channel) {
            return $http.post('/rtc/group_conversations/', getPostObject(channel));
        }

        //register a stream on the server
        function registerStream() {
            return $http.post('/rtc/moderated_discussion/', getPostObject("register_stream"));
        }

        //logout the client from the server
        function rtcLogout(view) {
            $http.post('/rtc/' + view +'/', getPostObject("logout"));
        }

        return {
            rtcLogin: rtcLogin,
            getRtcUserList: getRtcUserList,
            registerStream: registerStream,
            getGroupChannels: getGroupChannels,
            switchChannel: switchChannel,
            rtcLogout: rtcLogout
        };
    }
])

//Provides functions to access media and data
.factory('MediaAccess', [
    '$timeout',
    function($timeout) {
        //chat logs
        var messageHistory = {};

        //all media constraints in an object for easier access
        var constraints = {
            audioVideo: {
                audio: true,
                video: true
            },
            videoOnly: {
                video: true,
                audio: false
            },
            audioOnly: {
                video: false,
                audio: true
            },
        }

        //pushes the data (a message) in the history array of a given id
        //id: INT OpenSlides UserID
        //data: OBJECT the message
        function saveChatMessageInHistory(id, data) {
            if (!messageHistory[id]) {
                messageHistory[id] = [];
            }
            $timeout(function () {
                messageHistory[id].push({
                    user: data.user,
                    message: data.message,
                    time: data.time
                });

                console.log('message history: ' , messageHistory);
            });
        }

        //returns the ChatHistory of the given ID
        function getChatHistory(id) {
            if(!messageHistory[id]) {
                messageHistory[id] = [];
            } 
            return messageHistory[id];
        }

        //calls the UserGetMedia function
        function getMediaClient(mediaConstraints) {
            return navigator.mediaDevices.getUserMedia(mediaConstraints).then(function(localStream) {
                window.localStream = localStream;
            }).catch(function(error) {
                console.log('An Error during getMediaClient ? -> ' , error);
            });
        }

        //stops local media such as voice and video transmitting
        function stopMedia() {
            if (window.localStream) {
                angular.forEach(window.localStream.getTracks(), function (track) {
                    console.log('track ' , track);
                    track.stop();   
                });
                window.localStream = null;
            }
        }

        function toggleMuteMic() {
            if(window.localStream.getAudioTracks()) {
                if(window.localStream.getAudioTracks()[0].enabled) {
                    window.localStream.getAudioTracks()[0].enabled = false
                } else {
                    window.localStream.getAudioTracks()[0].enabled = true
                }
            }
        }

        function toggleDisplayVideo() {
            if(window.localStream.getVideoTracks()) {
                if(window.localStream.getVideoTracks()[0].enabled) {
                    window.localStream.getVideoTracks()[0].enabled = false
                } else {
                    window.localStream.getVideoTracks()[0].enabled = true
                }
            }
        }

        return {
            constraints: constraints,
            saveChatMessageInHistory: saveChatMessageInHistory,
            getChatHistory: getChatHistory,
            getMediaClient: getMediaClient,
            stopMedia: stopMedia,
            toggleMuteMic: toggleMuteMic,
            toggleDisplayVideo: toggleDisplayVideo
        }
    }
])

//functions for peer connection and signalling
.factory('PeerConnection', [
    '$timeout',
    'operator',
    'Notify',
    'MediaAccess',
    function($timeout, operator, Notify, MediaAccess) {
        var clients = {};
        var remoteVideo;
        var streamerVideo;
        var remoteAudioStreams = {};

        var iceServerConfig = {
            iceServers: [
                {
                    'urls': 'stun:stun4.l.google.com:19302'
                },
                {
                    'urls': 'stun:stun.services.mozilla.com:3478'
                },
                {
                    urls: "stun:numb.viagenie.ca",
                    username: "sean.f.t.engelhardt@gmail.com",
                    credential: "openslides"
                },
                {
                    urls: "turn:numb.viagenie.ca",
                    username: "sean.f.t.engelhardt@gmail.com",
                    credential: "openslides"
                }
            ]
        };

        // Notification object. Let watch/observe it to get notifications about RTC health, connections and messages
        var userNotification = {
            type : "",
            message : "",
            time: "" //set an ever changin value so multiple messages can be queued
        }

        //connects to a client
        //target: ID in OpenSlides
        //name: username of target. For Message-Notifications
        //offer: should be true if initial, false if it's an answer
        //video: stream-object if video, false if not
        function connectToClient(id, name, offer, stream, media) {
            var peerConfig = {
                initiator: offer,
                stream: stream,
                reconnectTimer: 1000,
                iceTransportPolicy: 'relay',
                tickle: true,
                config: iceServerConfig
            };

            if (clients[id] === undefined) {
                clients[id] = {};
                clients[id].name = name;
            }
            if (clients[id].history === undefined) {
                clients[id].history = [];
            }
            if (clients[id].peer === undefined) {
                clients[id].peer = new SimplePeer(peerConfig);
                var doSendStream = false
                if (stream) {
                    doSendStream = true
                }
                setupPeer(id, doSendStream, media);
            }
            return clients[id].peer;
        }

        //returns true if the peer if an ID is connected
        function isClientConnectionActive(id) {
            if (clients[id] && typeof clients[id].peer !== "undefined") {
                console.log('clientConnectionActive, connection is ' , clients[id].peer.connected);
                return clients[id].peer.connected;
            } else {
                console.log('clientConnectionActive, did not find client.');
                return false
            }
        }
        
        //setup all the peer magic
        function setupPeer(id, stream, media) {
            var peer = clients[id].peer;
            peer.on('signal', function (data) {
                console.log('send SDP to client:' , id);
                Notify.notify("signalling", {
                    id: operator.user.id,
                    name: operator.user.username,
                    signal: data,
                    stream: stream,
                    media: media
                }, [id]);
            });

            peer.on('connect', function () {
                console.log('peer is connected: ' , peer);
                var peerName = clients[getIdFromPeer(peer)].name;
                newUserNotification("established a connection with " +peerName , "success");
            });

            peer.on('close', function (msg) {
                console.log('connection closed by peer: ' , peer, '\n with message: ' , msg , '\n media was: ', media);
                var peerName = clients[getIdFromPeer(peer)].name;
                newUserNotification("Connection with " + peerName + " was closed", "info");
                removePeerFromClient(peer);
            });

            peer.on('stream', function (stream) {
                console.log('stream incomming: ' , stream ,'\n from peer: ' , peer, "\n media was : " , media);
                var peerId = getIdFromPeer(peer);
                var peerName = clients[peerId].name;
                
                if(media == "stream") {
                    newUserNotification({name: peerName, id: peerId}, "newStream");
                    streamerVideo.srcObject = stream;
                    streamerVideo.muted = false;
                }
                if(media == "video") {
                    newUserNotification("Incomming Video Stream from " + peerName, "success");
                    remoteVideo.srcObject = stream;
                }
                //register incomming audio Streams to the remoteAudioStreams
                if(media == "audio") {
                    newUserNotification("Incomming Audio Stream from " + peerName, "success");
                    console.log('set stream for: ' , peerName);
                    remoteAudioStreams[peerName].srcObject = stream;
                }
            });

            peer.on('error', function (error) {
                console.log('connection error' , error);
                var peerName = clients[getIdFromPeer(peer)].name;
                newUserNotification("Peer connection Error with " + peerName, "warning");
            });
            
            peer.on('data', function (data) {
                var jsonData = JSON.parse(data);
                console.log('incomming via data channel: ' , jsonData);
                if (jsonData.type == "chatMessage") {
                    newUserNotification(jsonData, "unreadChat");
                    MediaAccess.saveChatMessageInHistory(jsonData.id, jsonData);
                }
            });
        }

        //register the Video HTML Object in the Factory to enable access from peers
        function registerVideoField(video) {
            if(video) {
                if (video.id == "remoteVideo") {
                    remoteVideo = video;
                } else if (video.id == "moderatorVideo") {
                    moderatorVideo = video;
                } else if (video.id == "streamerVideo") {
                    streamerVideo = video;
                }
            }
        }

        //function register audio objects from group controler in the factory
        function registerAudioField(audioTag, name) {
            console.log('register Audio Field for: ' , name);
            remoteAudioStreams[name] = audioTag;
        }

        //returns the peer form a given ID. Used by other factories
        function getPeer(id) {
            if (id > 0 && clients[id] && clients[id].peer) {
                return clients[id].peer;
            }
        }

        //returns the ID of a give peer if exists
        function getIdFromPeer(peer) {
            var peerId = 0;
            angular.forEach(clients, function(client, id) {
                if (peer == client.peer) {
                    peerId = id;
                }
            });
            return peerId;
        }

        function removePeerFromClient(peer) {
            var peerId = getIdFromPeer(peer);
            if (peerId > 0 ) {
                disconnectFromClient(peerId);
            }
        }

        //disconnects from a client and delete the peer
        function disconnectFromClient(id) {
            console.log("disconnect from ID " , id);
            if (clients[id].peer) {
                clients[id].peer.destroy();
                clients[id].peer = undefined;
            }
        }

        //disconnects from all clients
        function disconnectAllClients() {
            console.log('disconnect from all clients');
            angular.forEach(clients, function(client, id) {
                disconnectFromClient(id);
            });
        }

        function newUserNotification(message, type) {
            $timeout(function () {
                userNotification.message = message;
                userNotification.type = type;
                userNotification.time = new Date();
            });
        }

        return {
            registerVideoField: registerVideoField,
            registerAudioField: registerAudioField,
            connectToClient: connectToClient,
            isClientConnectionActive: isClientConnectionActive,
            getPeer: getPeer,
            userNotification: userNotification,
            disconnectFromClient: disconnectFromClient,
            disconnectAllClients: disconnectAllClients
        };
    }
])

//functions for peer to peer communication
.factory('PeerCommunication', [
    '$timeout',
    'operator',
    'Notify',
    'Messaging',
    'MediaAccess',
    'PeerConnection',
    function ($timeout, operator, Notify, Messaging, MediaAccess, PeerConnection) {
        // notifications
        // exchange of signalling information
        // var peer will be a new client if first called
        // var peer will be an existing peer on every other call
        var signallingCallback = Notify.registerCallback("signalling" , function (notify) {
            if (!notify.sendBySelf) {
                var clientInfo = notify.params;
                startCommunication(clientInfo.id, clientInfo.name, clientInfo.media, false, clientInfo.signal);
            }
        });

        //function to start a chat, video or call
        function startCommunication(target, name, media, intial, signal) {
            // new version of feross will support renogitation
            if (PeerConnection.isClientConnectionActive(target) && (media == "video" || media == "audio")) {
                PeerConnection.disconnectFromClient(target);
            }

            var peer = PeerConnection.connectToClient(target, name, intial, window.localStream, media);
            if (!intial) {
                peer.signal(signal);
            }
        }

        //hitting enter when the chat input field is active
        //call from page controllers
        function chatInputEnterKeyHandler(key, target, input, channelName) {
            if(key.which == 13) {
                key.preventDefault();
                processSendingChatMessage(target, input, channelName);
            }
        }

        //give the message to the factory to send it over a peer Connection
        //and save it in the history
        function processSendingChatMessage(target, inputField, channelName) {
            //needs to be declared in order to send it into the factory
            // var inputFieldText = $("#chat-input")[0].value;
            var inputFieldText = inputField.value;
            var currentTime = new Date();
            var chatMessage = {
                type: "chatMessage",
                id: operator.user.id,
                user: operator.user.username,
                message: inputFieldText,
                time: currentTime
            };
            inputField.value = "";

            //if target is an array, this is a group message
            if(target.constructor === Array) {
                MediaAccess.saveChatMessageInHistory(channelName, chatMessage);
                angular.forEach(target, function (id) {
                    sendChat(id, chatMessage);
                });
            } else {
                MediaAccess.saveChatMessageInHistory(target, chatMessage);
                sendChat(target, chatMessage);
            }
        }

        //send a chat over DataChannel
        function sendChat(target, chatMessage) {
            var messageStr = JSON.stringify(chatMessage);
            console.log('send to peer: ' , messageStr);
            PeerConnection.getPeer(target).send(messageStr);
        }

        //close streams and renegotiate.
        function hangUpPrivateCall(target, name) {
            MediaAccess.stopMedia();
            var peer = PeerConnection.getPeer(target);
            console.log('hangUpPrivateCall, peer: ' , peer);
            if(peer.stream && peer.connected) {
                PeerConnection.disconnectFromClient(target);
                $timeout(function () {
                    //new version of simplepeer will support adding and removing streams
                    startCommunication(target, name, "chat", true);
                }, 500);
            }
        }

        //display incomming messages in the chat area
        function addMessagesToChatField(id, chatArea) {
            console.log('add messages to field id: ' , id , " area: " , chatArea);
            var messages = MediaAccess.getChatHistory(id);
            chatArea.innerHTML = ""; //delete the content first
            angular.forEach(messages, function (message) {
                var messageTime = new Date(message.time);
                var chatString = "[" + messageTime.getHours() + ":" + messageTime.getMinutes() + ":" +
                    messageTime.getSeconds() + "] " + message.user + ": " + message.message + "<br />";
                chatArea.innerHTML += chatString;
            });
        }

        //shows a message using OpenSlides Messaging API 
        function addGuiMessage(message, type) {
            $timeout(function () {
                Messaging.addMessage(message, type, {timeout: 3000});
            });
        }

        return {
            startCommunication: startCommunication,
            chatInputEnterKeyHandler: chatInputEnterKeyHandler,
            processSendingChatMessage: processSendingChatMessage,
            sendChat: sendChat,
            hangUpPrivateCall: hangUpPrivateCall,
            addGuiMessage: addGuiMessage,
            addMessagesToChatField: addMessagesToChatField,
        }
    }
])

.config([
    '$stateProvider',
    function ($stateProvider) {
        $stateProvider
            .state('openslides_conversations_moderated', {
                url: '/openslides_conversations',
                templateUrl: 'static/templates/openslides_conversations/moderated-discussion.html',
            })
            .state('openslides_conversations_private', {
                url: '/openslides_conversations/private',
                templateUrl: 'static/templates/openslides_conversations/private-chat.html',
            })
            .state('openslides_conversations_group', {
                url: '/openslides_conversations/group',
                templateUrl: 'static/templates/openslides_conversations/group-conversation.html',
            });
    }
])

//the user bar hook
.controller('OpenSlidesConversationsUserBarHookCtrl', [
    '$scope',
    'MediaAccess',
    function ($scope, MediaAccess) {

        function setElementSignal(element, signal) {
            if (signal) {
                element.setAttribute ("class", "on-air");
            } else {
                element.removeAttribute("class", "on-air");
            }
        }

        $scope.recordIndicatorIcon = function() {
            MediaAccess.toggleMuteMic();
        };

        $scope.videoIndicatorIcon = function() {
            MediaAccess.toggleDisplayVideo();
        };

        // AUDIO watch the window.localstream to change the indicators
        $scope.$watch(function() {
            if(window.localStream && window.localStream.getAudioTracks()[0]) {
                return window.localStream.getAudioTracks()[0].enabled
            }
        },
        function(newValue, oldValue) {
            setElementSignal($("#recordMicIndicator")[0], newValue);
        });

        // VIDEO watch the window.localstream to change the indicators
        $scope.$watch(function() {
            if(window.localStream && window.localStream.getVideoTracks()[0]) {
                return window.localStream.getVideoTracks()[0].enabled
            }
        },
        function(newValue, oldValue) {
            setElementSignal($("#recordVidIndicator")[0], newValue);
        });
    }
])

//the 'moderated discussion' page
.controller('OpenSlidesConversationsModeratedDiscussionCtrl', [
    '$scope',
    '$timeout',
    '$http',
    'MediaAccess',
    'PeerConnection',
    'PeerCommunication',
    'Config',
    'RtcRegister',
    'Notify',
    'User',
    'operator',
    function ($scope, $timeout, $http, MediaAccess, PeerConnection, PeerCommunication, Config, RtcRegister, Notify, User, operator) {
        // select the stream
        var streamObject;
        var streamMediaConstraints;
        var onAir = false; //semaphore. Set true if streaming, false if not. Safer logic stream handover
        if(Config.get('enable_video_streaming').value) {
            streamObject = $("#streamerVideo")[0];
            streamMediaConstraints = MediaAccess.constraints.audioVideo;
        } else {
            streamObject = $("#streamerAudio")[0];
            streamMediaConstraints = MediaAccess.constraints.audioOnly;
        }

        //when a moderator asks somebody to open the Stream
        var streamActionCallback = Notify.registerCallback("streamAction" , function (notify) {
            var name = notify.params.name
            console.log('got Stream Action Notification');
            if(notify.params.action == "startStream") {
                console.log(''+name+' told to open the stream');
                startStream();
            } else if (notify.params.action == "stopStream") {
                stopStreaming();
            }
        });

        //when a new viewer comes to the page
        var newStreamViewerCallback = Notify.registerCallback("newStreamViewer" , function (notify) {
            console.log('a new viewer requested the stream');
            if(onAir) {
                var name = notify.params.name
                var id = notify.params.id

                //the other side needs some time to build the DOM first
                $timeout(function() {
                    PeerCommunication.startCommunication(id, name, "stream", true);
                }, 2000)
                
            } else {
                console.log('but there is no stream ongoin');
            }
        });

        function callPage() {
            //bind all users in scope, so a moderator can access them
            User.bindAll({}, $scope, 'users');
            $scope.speakerSelectBox = {};

            console.log('welcome to Moderated Discussions');
            PeerConnection.registerVideoField(streamObject);
            RtcRegister.rtcLogin("moderated_discussion").success( function(httpResponse) {
                console.log('login to moderated discussion as participant ' , httpResponse); //maybe get the current streamer and moderator
                if(httpResponse.id > 0) {
                    console.log('seems to be an active stream');
                    Notify.notify( "newStreamViewer", {
                        name: operator.user.username,
                        id: operator.user.id,
                    }, [httpResponse.id] );
                } else {
                    console.log('seems there is no active stream');
                }
            });
        }

        //interrupts a streamer and returns a number
        //use the number to delay the code after the interruption
        //to ensure a safe handover of streams
        //the streamer needs some time to safely close the connection
        //can be replaced with an confirmation by the streamer or anything
        function interruptStreamer() {
            if($scope.streamId) {
                var id = parseInt($scope.streamId);
                Notify.notify( "streamAction", {
                    name: operator.user.username,
                    id: operator.user.id,
                    action: "stopStream"
                }, [id] );
                return 100;
            } else {
                console.log('($scope.streamId not set');
                return 0;
            }
        }

        function startStream() {
            PeerCommunication.addGuiMessage("Start a stream", "info");
            var delay = interruptStreamer();
            //disconnect from all clients before continiue
            PeerConnection.disconnectAllClients();
            //start is delayed to ensure safe handover
            $timeout(function () {
                MediaAccess.getMediaClient(streamMediaConstraints).then(function () {
                    //set the source object for the video
                    streamObject.srcObject = window.localStream;
                    showStreamControls(true);
                    //mute the video so we do not hear ourselfs
                    streamObject.muted = true;
                    //get all active users who can receive a stream
                    return RtcRegister.registerStream().success(function(httpResponse) {
                        //set "on air" flag
                        onAir = true;
                        $scope.streamName = operator.user.username;
                        var listeners = httpResponse.list
                        for (var userName in listeners) {
                            if (listeners.hasOwnProperty(userName)) {
                                if (userName !== operator.user.username) {
                                    console.log('start connection with : ' , userName);
                                    PeerCommunication.startCommunication(listeners[userName].id, userName, "stream", true);
                                }
                            }
                        }
                    });
                });
            }, delay)
        }

        function stopStreaming() {
            onAir = false
            console.log('stop streaming');
            MediaAccess.stopMedia();
            PeerConnection.disconnectAllClients();
            showStreamControls(false);
        }

        function showStreamControls(bool) {
            var streamControls = $("#streamer-control-panel")[0];
            if(bool) {
                streamControls.removeAttribute("class", "hide");
            } else {
                streamControls.setAttribute("class", "hide");
            }
        }

        // add user to list of speakers
        $scope.selectStreamer = function (userId) {
            //interrupt the current streamer if any
            var delay = interruptStreamer();
            //get the username
            var username = "";
            angular.forEach($scope.users, function (user) {
                if (user.id == userId) {
                    username = user.full_name
                }
            })
            console.log('name = ' , username);
            //tell the user to make a stream

            $timeout(function (params) {
                Notify.notify( "streamAction", {
                    name: operator.user.username,
                    id: operator.user.id,
                    action: "startStream"
                }, [userId] );
            }, delay)
            $scope.speakerSelectBox = {};
        };

        $scope.streamerMuteMicButton = function() {
            MediaAccess.toggleMuteMic();
        };

        $scope.streamerHideVideoButton = function() {
            MediaAccess.toggleDisplayVideo();
        };

        $scope.streamerStopStreamButton = stopStreaming;

        $scope.streamModMediaButton = startStream;

        //watch the userNotification object for RTC health
        $scope.$watchCollection(function() {
            return PeerConnection.userNotification;
        },
        function(newValue, oldValue) {
            if (newValue !== oldValue) {
                if(newValue.type == "newStream") {
                    $scope.streamName = newValue.message.name;
                    $scope.streamId = newValue.message.id;
                } else {
                    PeerCommunication.addGuiMessage(newValue.message, newValue.type);  
                }
            }
        });

        // AUDIO watch the window.localstream to change the indicators
        $scope.$watch(function() {
            if(window.localStream && window.localStream.getAudioTracks()[0]) {
                return window.localStream.getAudioTracks()[0].enabled
            }
        },
        function(newValue, oldValue) {
            var micButton = $("#muteMicButton")[0]
            if (newValue) {
                micButton.removeAttribute("class", "fa-microphone-slash");
                micButton.setAttribute ("class", "fa fa-microphone");
            } else {
                micButton.removeAttribute("class", "fa-microphone");
                micButton.setAttribute ("class", "fa fa-microphone-slash");
            }
        });

        // VIDEO watch the window.localstream to change the indicators
        $scope.$watch(function() {
            if(window.localStream && window.localStream.getVideoTracks()[0]) {
                return window.localStream.getVideoTracks()[0].enabled
            }
        },
        function(newValue, oldValue) {
            var vidButton = $("#hideVideoButton")[0]
            if (newValue) {
                vidButton.removeAttribute("class", "fa-fa-pause");
                vidButton.setAttribute ("class", "fa fa-video-camera");
            } else {
                vidButton.removeAttribute("class", "fa-video-camera");
                vidButton.setAttribute ("class", "fa fa-pause");
            }
        });

        callPage();
    }
])

//the 'group conversations' page
.controller('OpenSlidesConversationsGroupConversationsCtrl', [
    '$scope',
    '$timeout',
    'MediaAccess',
    'PeerConnection',
    'PeerCommunication',
    'RtcRegister',
    'Notify',
    'operator',
    function ($scope, $timeout, MediaAccess, PeerConnection, PeerCommunication, RtcRegister, Notify, operator) {
        var channels = null;
        $scope.connectedChannel = ""
        var currentConnectionIds = []; //holds the ID's of all users we are currently connected with. For sending messages to a group.

        //notifications
        var updateChannelsCallback = Notify.registerCallback("update_channels" , function (notify) {
            if (!notify.sendBySelf) {
                updateChannelList().then(function (params) {
                    if($scope.connectedChannel === notify.params.channel) {
                        PeerCommunication.addGuiMessage(""+notify.params.name + " joined your channel", "info");
                        currentConnectionIds.push(notify.params.id);
                        PeerConnection.registerAudioField($("#audio-"+notify.params.name)[0], notify.params.name);
                    } 
                });
            }
        });

        //user visits the page
        function callPage() {
            console.log('RTC Features: ' , DetectRTC);
            if(DetectRTC.isWebRTCSupported) {
                $("#channel-list-ul").on('click', channelListClickHandler);
                $("#chat-input").keypress(function (key) {
                    PeerCommunication.chatInputEnterKeyHandler(key, currentConnectionIds, $("#chat-input")[0], $scope.connectedChannel);
                });
                updateChannelList().then(function(httpResponse) {
                    var serverChannels = httpResponse.data.channel_list
                    angular.forEach(serverChannels, function (channel, channelName) {
                        angular.forEach(channel, function (user) {
                            if (user.id === operator.user.id) {
                                PeerCommunication.addGuiMessage("you are still active in " + channelName, "info"),
                                $scope.connectedChannel = channelName;
                            }
                        });
                    });
                });
            } else {
                PeerCommunication.addGuiMessage("Your Browser does not support WebRTC.", "error");
            }
        }

        function channelListClickHandler(listEntry) {
            var channelId = listEntry.target.id;
            var channelClass = listEntry.target.className
            $timeout(function() { //to manipulate the scope view, respect the digist cycle
                console.log('channel name: ' , listEntry);
                if (channelClass == "channel-li") {
                    registerToSpeechChannel(channelId);
                } else {
                    console.log("not a channel: " , listEntry.target);
                }
            });
        }

        //register to a speech channel
        //If the channel dies not exist it will be created on the server
        function registerToSpeechChannel(channelName) {
                //register on the python server
                RtcRegister.switchChannel(channelName); //TODO function for channels
                //remove all currently active peer connections
                PeerConnection.disconnectAllClients();
                updateChannelList().then(function () {
                    RtcRegister.getRtcUserList("group_conversations").then(function (httpResponse) {
                        Notify.notify( "update_channels", {
                            name: operator.user.username,
                            id: operator.user.id,
                            channel: channelName
                        }, httpResponse.list );
                    });

                    //save or remove the channel name. Not friendy for reloading the page
                    if($scope.connectedChannel !== channelName) {
                        $scope.connectedChannel = channelName;
                        MediaAccess.getMediaClient(MediaAccess.constraints.audioOnly).then(function () {
                            PeerCommunication.addGuiMessage("Connected to " + channelName, "info");
                            connectToChannelUsers(channelName)
                        });
                    } else {
                        $scope.connectedChannel = "";
                        PeerCommunication.addGuiMessage("You left " + channelName, "info");
                        MediaAccess.stopMedia();
                    }
                });
        }

        //Establishes multiple peer connections with every single channel user
        //make sure updateChannelList was executed first
        function connectToChannelUsers(channelName) {
            if (channels) {
                currentConnectionIds = [];
                angular.forEach(channels[channelName], function channel(user) {
                    //look for open connections for people who are not in the channel
                    //and close them.
                    if (user.id !== operator.user.id) {
                        console.log('make connection to ' + user.name)
                        currentConnectionIds.push(user.id);
                        PeerConnection.registerAudioField($("#audio-"+user.name)[0], user.name);
                        PeerCommunication.startCommunication(user.id, user.name, "audio", true);
                    }
                })
            }
        }

        //refresh the list of channels. Loads a new channel list from the server
        //and populates the user list
        function updateChannelList() {
            return RtcRegister.getGroupChannels().success(function(httpResponse) {
                channels = httpResponse.list;
                var newChannelListHtml = "";
                angular.forEach(Object.keys(channels), function (channel) {
                    //TODO maybe use this via template hooks
                    newChannelListHtml += `
                        <li id="${channel}" class="channel-li">
                            <i class="fa fa-phone"></i> ${channel}
                            <!-- span class="pull-right"> X / Y </span> -->
                            <ul class="list-unstyled" class="channel-users-ul">`
                    angular.forEach(channels[channel], function (user) {
                        newChannelListHtml += `
                        <li>
                            <i class="fa fa-user"></i>
                            ${user.name}
                            <audio id="audio-${user.name}" autoplay></audio>
                        </li>`
                    })
                    newChannelListHtml += "</ul></li>"
                });
                $("#channel-list-ul")[0].innerHTML = newChannelListHtml;
            });
        }

        // Click on the send Message button 
        $scope.sendMessageButton = function() {
            PeerCommunication.processSendingChatMessage(currentConnectionIds, $("#chat-input")[0], $scope.connectedChannel);
        };

        //watch the length of the group chat history for changes
        $scope.$watch(function() {
            if ($scope.connectedChannel !== "") {
                return MediaAccess.getChatHistory($scope.connectedChannel).length;
            }
        },
        function() {
            if ($scope.connectedChannel !== "") {
                PeerCommunication.addMessagesToChatField($scope.connectedChannel, $("#groupChatField")[0]);
            }
        });

        //watch the userNotificationObject for changes
        $scope.$watchCollection(function() {
            return PeerConnection.userNotification;
        },
        function(newValue, oldValue) {
            if (newValue !== oldValue) {
                if (newValue.type === "unreadChat") {
                    console.log('new chat');
                    MediaAccess.saveChatMessageInHistory($scope.connectedChannel, newValue.message)
                } else {
                    PeerCommunication.addGuiMessage(newValue.message, newValue.type);
                }
            }
        });

        callPage();
    }
])

//the 'private chat' page
.controller('OpenSlidesConversationsPrivateChatCtrl', [
    '$scope',
    '$timeout',
    'MediaAccess',
    'PeerConnection',
    'PeerCommunication',
    'RtcRegister',
    'Notify',
    'operator',
    function ($scope, $timeout, MediaAccess, PeerConnection, PeerCommunication, RtcRegister, Notify, operator) {
        var rtcUsers; //object holdung the users who are currently active in the communication page
        var chatPartner = {
            id : 0,
            name : ""
        };

        //triggers whenever a user visits or leaves the page
        //updates the list of available RTC users
        var refreshUserListCallback = Notify.registerCallback("refresh_user_list" , function (notify) {
            if(!notify.sendBySelf) {
                RtcRegister.getRtcUserList("private_conversations").success(populateUserList);
            }
        });

        //when a peer wants to call
        var callNotificationCallback = Notify.registerCallback("callNotification" , function (notify) {
            console.log('callNotificationCallback');
            //TODO semaphore
            $scope.caller = notify.params.name;
            $scope.callerId = notify.params.id;
            $('#userNotifications').append($("#incomming-call-alert")[0]);
        });

        //weather somebody accepted or denied a call request
        var callRequestAnswerCallback = Notify.registerCallback("callRequestAnswer" , function (notify) {
            console.log('callRequestAnswer' , notify);

            if(notify.params.answer) {
                console.log('start video now');
                PeerCommunication.startCommunication(notify.params.id, notify.params.name, "video", true);
            } else {
                console.log('stop video now');
                showVideoField(false);
                PeerCommunication.addGuiMessage(""+notify.params.name + " denied your call request", "error");
            }
        });

        //filling the user list in the private chat menu with content
        function populateUserList(response) {
            if ($("#user-list-ul")[0]) {
                rtcUsers = response.list;
                var newUserListHtml = "";
                for (var userName in rtcUsers) {
                    if (rtcUsers.hasOwnProperty(userName)) {
                        //User is available and not yourself
                        if (rtcUsers[userName].available && userName !== operator.user.username) {
                            newUserListHtml += '<li id="user-list-'+userName+'">'+ userName + '<i></i></li>';
                        }
                    }
                }
                $("#user-list-ul")[0].innerHTML = newUserListHtml;
            }
        }

        //clicking on user list to select a user to chat with
        function userListClickHandler(listEntry) {
            var clickedName = listEntry.target.firstChild.data;
            //if click on the own name, do nothing
            if (clickedName !== operator.user.username) {
                $timeout(function() { //to manipulate the scope view, respect the digist cycle
                    chatPartner.name = clickedName;
                    chatPartner.id = rtcUsers[clickedName].id;
                    PeerCommunication.startCommunication(chatPartner.id, chatPartner.name, "none", true);
                    $scope.connectionName = chatPartner.name;
                    PeerCommunication.addMessagesToChatField(chatPartner.id, $("#privateChatField")[0]);
                    removeUnreadNoticiation(chatPartner.name);
                });
            }
        }

        //Show a "unread messages" symbol in contact list next to a contact
        function unreadMessageNotification(contact) {
            var test = rtcUsers[contact];
            if (test && test.available && contact !== chatPartner.name) {
                var contactElement = $("#user-list-"+contact)[0];
                contactElement.setAttribute("class", "unreadPM");
                contactElement.children[0].setAttribute("class", "fa fa-envelope pull-right");
            }
        }

        //hack to remove unread PM noticiation on click
        function removeUnreadNoticiation(contact) {
            var contactElement = $("#user-list-"+contact)[0];
            if (contactElement.classList.contains("unreadPM")) {
                contactElement.removeAttribute("class", "unreadPM");
                contactElement.children[0].removeAttribute("class", "fa fa-envelope pull-right");
            }
        }

        function showVideoField(doDisplay) {
            var videoControlField = $("#video-control-field");
            console.log('videoControlField: ' , videoControlField);
            if(doDisplay) {
                console.log('try to display field');
                videoControlField.css("display", "inline");
                $("#localVideo")[0].srcObject = window.localStream;
            } if (!doDisplay) {
                videoControlField.css("display", "none");
                $("#localVideo")[0].srcObject = null;
            }
        }

        //TODO use this also for moderated
        function getCallConsent(target) {
            Notify.notify("callNotification", {
                id: operator.user.id,
                name: operator.user.username
            }, [target]);
        }

        //user visits the page
        function callPage() {
            //click and keypress handler
            console.log('RTC Features: ' , DetectRTC);
            if(DetectRTC.isWebRTCSupported) {
                $("#user-list-ul").on('click', userListClickHandler);
                $("#private-chat-input").keypress( function(key) {
                    PeerCommunication.chatInputEnterKeyHandler(key, chatPartner.id, $("#private-chat-input")[0]);
                });    
                //register on the python server
                RtcRegister.rtcLogin("private_conversations").success( function(httpResponse) {
                    populateUserList(httpResponse);
                    Notify.notify("refresh_user_list");
                });
    
                //register remote video HTML object in Factory
                PeerConnection.registerVideoField($("#remoteVideo")[0]);
            } else {
                PeerCommunication.addGuiMessage("Your Browser does not support WebRTC.", "error");
            }
        }

        // Callback for the send button
        $scope.sendMessageButton = function() {
            PeerCommunication.processSendingChatMessage(chatPartner.id, $("#private-chat-input")[0]);
        };

        //start video connection
        $scope.videoCallButton = function() {
            if (chatPartner.id > 0 ) {
                //get the Media and pass it to startCommunication directly. window.localStream is our video now
                MediaAccess.getMediaClient(MediaAccess.constraints.audioVideo).then(function () {
                    showVideoField(true);
                    getCallConsent(chatPartner.id);
                });
            } else {
                console.log("No Partner selected");
            }
        };
        
        //button so answer a call
        $scope.answerCallButton = function(consent) {
            if ($scope.caller) {
                var requestAnswerObject = {
                    id: operator.user.id,
                    name: operator.user.username,
                    answer: consent
                };
                if (consent) {
                    MediaAccess.getMediaClient(MediaAccess.constraints.audioVideo).then(function () {
                        showVideoField(true);
                        Notify.notify("callRequestAnswer", requestAnswerObject, [$scope.callerId]);
                    });
                } else {
                    Notify.notify("callRequestAnswer", requestAnswerObject, [$scope.callerId]);
                }
            }
        }

        //on stop button stop the local video
        $scope.videoHangUpButton = function() {
            showVideoField(false);
            PeerCommunication.hangUpPrivateCall(chatPartner.id, chatPartner.name);
        };

        //if user leaves the scope, stop the video, close peerConnection(s) if any
        $scope.$on("$destroy", function() {
            console.log("destroy scope");
            RtcRegister.rtcLogout("private_conversations");
            Notify.notify("refresh_user_list");
        });

        // watches the length of privateMessageArray. Trigger, when the length changes
        $scope.$watch(function() {
            if (chatPartner.id > 0 ) {
                return MediaAccess.getChatHistory(chatPartner.id).length;
            }
        },
        function() {
            if (chatPartner.id > 0 ) {
                PeerCommunication.addMessagesToChatField(chatPartner.id, $("#privateChatField")[0]);
            }
        });

        //watches the userNotification Object in the PeerConnection factory
        $scope.$watchCollection(function() {
            return PeerConnection.userNotification;
        },
        function(newValue, oldValue) {
            if (newValue !== oldValue) {
                if (newValue.type === "unreadChat") {
                    unreadMessageNotification(newValue.message.user);
                } else {
                    PeerCommunication.addGuiMessage(newValue.message, newValue.type);
                }
            }
        });

        callPage();
    }
]);

}());
