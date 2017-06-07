var express = require('express');
var router = express.Router();
var firebase = require("firebase");
var FCM = require('fcm-node');
var serverKey = 'AAAAuEcBSz0:APA91bETO6VLcRD-fRNvbU3ULlozZi_UTYtxn8ja3-TVnxEYUiut7YiLbzhdXSKOGhIjJuxjNvEqjz19yCuJykPMwv12JrGg-eqPxWxPbTgO-lgrImp24WXuK-K1u-x7Dbp9pVn2jHlw';
var fcm = new FCM(serverKey);
const gcloud = require('google-cloud');

var config = {
    appName: "vaportalk",
    apiKey: "AIzaSyDigu179_TBrh8xU7C_ZgJypnpOKYxggFc",
    authDomain: "vaportalk-6725e.firebaseapp.com",
    databaseURL: "https://vaportalk-6725e.firebaseio.com",
    projectId: "vaportalk-6725e",
    storageBucket: "gs://vaportalk-6725e.appspot.com",
    messagingSenderId: "791465249597"
};

const storage = gcloud.storage({
    projectId: "vaportalk-6725e",
    keyFilename: './vaportalk-6725e-firebase-adminsdk-y7bx5-01cca11d56.json'
});

firebase.initializeApp(config);

var db = firebase.database();
const bucket = storage.bucket("vaportalk-6725e.appspot.com");

var ref = db.ref();

var usersRef = ref.child("/users");
var lastMessagesRef = ref.child("/lastMessages");
var messagesRef = ref.child("/messages");
var eventDataRef = ref.child("/eventData");
var commerceDataRef = ref.child("/commerceData");
var locationRef = ref.child("/locations");
var eventsRef = ref.child("/events");
var commercesRef = ref.child("/commerces");

//위도경도 거리 구하는 함수
//반환거리의 단위는 Km일 것이라고 예상됨
function calculateDistance(lat1, lon1, lat2, lon2) {
    var R = 6371; // km
    var dLat = (lat2-lat1).toRad();
    var dLon = (lon2-lon1).toRad();
    var a = Math.sin(dLat/2) * Math.sin(dLat/2) +
        Math.cos(lat1.toRad()) * Math.cos(lat2.toRad()) *
        Math.sin(dLon/2) * Math.sin(dLon/2);
    var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    var d = R * c;
    return d;
}
Number.prototype.toRad = function() {
    return this * Math.PI / 180;
}

setInterval(checkInterval,1000*60*5);

function changeDate(dateStr){

    var year = dateStr.substring(0,4);
    var month = dateStr.substring(5,7);
    var day = dateStr.substring(8,10);
    var hour = dateStr.substring(11,13);
    var minute = dateStr.substring(14,16);
    var second = dateStr.substring(17,19);

    var date = new Date(year,month-1,day,hour,minute,second);

    return date;
}

function checkInterval() {
    messagesRef.once('value').then(function (messagesSnap) {
        messagesSnap.forEach(function (toSnap) {
            toSnap.forEach(function (fromSnap) {
                fromSnap.forEach(function (messageSnap) {
                    var messageDate = changeDate(messageSnap.val()["timestamp"])
                    var today = Date.now();

                    if((today - messageDate.getTime())/1000/60/60/24 >= 1){
                        var contents = messageSnap.val()["contents"];
                        var from = messageSnap.val()["from"];
                        var to = toSnap.key;

                        ref.child("/"+messagesSnap.key).child("/"+to).child("/"+from).child("/"+messageSnap.key).remove();
                        bucket.file("vapor/" + to + "/" + from + "/" + contents).delete().then(function () {
                            console.log("delete" + contents);
                        }).catch(function (err) {
                            console.log(err);
                        });

                    }
                });
            });
        });
    });
}


function timerChange(timer){

    var hour = 0;
    var minute = 0;

    minute = parseInt(timer/60);
    if(minute >= 60){
        hour = parseInt(minute/60);
        minute = minute % 60;
    }

    if(hour == 0) {
        return (minute + "분");
    }else if(minute == 0){
        return (hour + "시간");
    }else{
        return (hour + "시간 " + minute + "분");
    }
}


function sendNotification(to, title, body){

    var message = { //this may vary according to the message type (single recipient, multicast, topic, et cetera)
        //유저  fcm 키 넣기
        to: to,
        //collapse_key: 'demo',

        notification: {
            title: title,
            body: body
        },

      /*data: {  //you can send only notification or only data(or include both)
       my_key: 'my value',
       my_another_key: 'my another value'
       }*/
    };

    fcm.send(message, function(err, response){
        if (err) {
            console.log("Something has gone wrong!");
        } else {
            console.log("Successfully sent with response: ", response);
        }
    });
}



function messageTimer(MessageID,from,to){

    var timeoutMessage = messagesRef.child("/" + to).child("/" + from).child("/" + MessageID);

    timeoutMessage.update({
        "isActive" : false
    });

    console.log("\ntimeout Message's activation is changed false. timeout message ID:"+ MessageID);
}


function eventTimer(eventID){
    var event = eventDataRef.child("/"+eventID);

    event.remove();

    eventsRef.once('value').then(function (snap){
        var count = 0;
        snap.forEach(function (receiverSnap) {
            receiverSnap.forEach(function (eventSnap) {
                if(eventSnap.key == eventID){
                    eventsRef.child("/" + Object.keys(snap.val())[count]).child("/" + eventSnap.key).remove();
                }
            });
            count++;
        });
    });
}



function commerceTimer(commerceID, receiver_count){

    var completedCommercesRef = ref.child("/completedCommerces").child("/"+commerceID);
    completedCommercesRef.set(receiver_count);

    commercesRef.once('value').then(function (snap){
        var count = 0;
        snap.forEach(function (receiverSnap) {
            receiverSnap.forEach(function (commerceSnap) {
                if(commerceSnap.key == commerceID){
                    commercesRef.child("/" + Object.keys(snap.val())[count]).child("/" + commerceSnap.key).remove();
                }
            });
            count++;
        });
    });
}


lastMessagesRef.on('child_changed', function(snap){
    var from = snap.val()["from"];
    var to = snap.key;
    console.log("\nObserver detect lastMessagesRef change!");
    console.log("to:" + to + ",  from:" + from);

    if(from != ""){
        messagesRef.child("/" + to).child("/" + from).orderByKey().limitToLast(1).once('value').then(function (snap){

            var lastMessageID = Object.keys(snap.val());
            var lastMessage = snap.val()[lastMessageID[0]];
            var message_timer = lastMessage["timer"];
            var timeStamp = lastMessage["timestamp"];

            //console.log("message contents:" + message_contents);
            console.log("last message ID:" + lastMessageID);
            console.log(lastMessageID + " message will be unactivated after " + message_timer + "second(s).");

            usersRef.child("/"+to).once('value').then(function(userSnap){

                var user = userSnap.val();
                if(user["isPushAgree"] == "true"){

                    usersRef.child("/"+from).once('value').then(function(fromUserSnap){
                        var userName = fromUserSnap.val()["name"];

                        var fcm = user["fcm"];
                        var changeTime = timerChange(message_timer);
                        sendNotification(fcm, userName + "님으로부터 베이퍼가 도착했습니다.", changeTime + " 남았습니다.");
                    });
                }
            });

            lastMessagesRef.child("/" + to).set({
                from:""
            });

            setTimeout(messageTimer,message_timer*1000,lastMessageID,from,to);

        })
    }
});



eventDataRef.on('child_added', function(snap){
    var event = snap.val();
    var event_ID = snap.key;
    var from = event["hostUID"];
    var event_long = event["longtitude"];
    var event_lat = event["latitude"];
    var event_timer = event["timer"];
    var distance = event["distance"];

    console.log("\nObserver detect eventDataRef change!");
    console.log("event host:" + from);
    console.log("event ID:" + event_ID);
    console.log("event_long:" + event_long + ", event_lat:" + event_lat);

    locationRef.once('value').then(function(locationSnap){

        locationSnap.forEach(function (childSnap) {

            var user_long = childSnap.val()["longtitude"];
            var user_lat = childSnap.val()["latitude"];
            var user_ID = childSnap.key;

            if(user_long != 0 && user_lat != 0){
                if(calculateDistance(event_lat,event_long,user_lat,user_long)*1000 <= distance){

                    if(user_ID != from) {
                        usersRef.child("/" + user_ID).once('value').then(function (userSnap) {
                            if (userSnap.val()["isPushAgree"] == "true") {
                                usersRef.child("/"+from).once('value').then(function(fromUserSnap) {
                                    var fcm = userSnap.val()["fcm"];
                                    var changeTime = timerChange(event_timer);
                                    sendNotification(fcm, fromUserSnap.val()["name"] + "님으로부터 이벤트가 도착했습니다.", changeTime + " 남았습니다.");
                                });
                            }
                        });
                    }

                    var eventsRef = ref.child("/events").child("/"+user_ID).child(snap.key);
                    eventsRef.set(true);
                }
            }
        });
    });

    console.log(event_ID + " event will be unactivated after " + event_timer + "second(s).");
    setTimeout(eventTimer,event_timer*1000,event_ID);
});

commerceDataRef.on('child_added', function(snap){
    var commerce = snap.val();
    var commerce_ID = snap.key;
    var from = commerce["hostUID"];
    var hostName = commerce["hostName"];
    var commerce_long = commerce["longtitude"];
    var commerce_lat = commerce["latitude"];
    var commerce_timer = commerce["timer"];
    var distance = commerce["distance"];

    console.log("\nObserver detect commerceDataRef change!");
    console.log("commerce host:" + from);
    console.log("commerce ID:" + commerce_ID);
    console.log("commerce_long:" + commerce_long + ", commerce_lat:" + commerce_lat);

    var count = 0;
    var commercesRef;

    locationRef.once('value').then(function(locationSnap){
        locationSnap.forEach(function (childSnap) {
            var user_long = childSnap.val()["longtitude"];
            var user_lat = childSnap.val()["latitude"];
            var user_ID = childSnap.key;

            if(user_long != 0 && user_lat != 0){
                if(calculateDistance(commerce_lat,commerce_long,user_lat,user_long)*1000 <= distance){
                    if(user_ID != from){
                        count++;
                        usersRef.child("/"+user_ID).once('value').then(function(userSnap){
                            if(userSnap.val()["isPushAgree"] == "true"){
                                var fcm = userSnap.val()["fcm"];
                                var changeTime = timerChange(commerce_timer);
                                sendNotification(fcm, hostName + "에서 커머스를 시작했습니다.", changeTime + " 남았습니다.");
                            }
                        });
                        commercesRef = ref.child("/commerces").child("/"+user_ID).child(snap.key);
                        commercesRef.set(true);
                    }
                }
            }
        });
    }).then(function(){
        console.log(commerce_ID + " commerce will be unactivated after " + commerce_timer + "second(s).");
        setTimeout(commerceTimer,commerce_timer*1000,commerce_ID, count);
    });

});


/!* GET home page. *!/
router.get('/', function(req, res, next) {
    res.render('index', { title: 'Express' });
});

module.exports = router;
