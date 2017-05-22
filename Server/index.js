/**
 * Created by 4 BITS on 08-Apr-17.
 */
const express = require('express');
const http = require('http');
const PORT = 3000;
const mqtt = require('mqtt');
const mqttbroker = "tcp://iot.eclipse.org";
const bodyParser = require('body-parser');
const client = mqtt.connect(mqttbroker);
const threshold = 500;
const nodemailer = require('nodemailer');
const moment = require('moment');
const debug = false;
const admin = require("firebase-admin");
const serviceAccount = require("./firebase/serviceAccountKey.json");
const Spinner = require('cli-spinner').Spinner;
admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: "https://healthy-office.firebaseio.com"
});
const db = admin.database();

var transporter = nodemailer.createTransport({
    host: 'mail.mailcone.com',
    port: 587, //local mail
    auth: {
        user: 'lakindu@surfedge.lk',
        pass: 'piumi'
    }
});

const app = express();
const router = express.Router();
app.use("/", router);
app.use(bodyParser.json());       // to support JSON-encoded bodies
app.use(bodyParser.urlencoded({     // to support URL-encoded bodies
    extended: true
}));
app.use(bodyParser.text());
app.use(bodyParser.raw());
router.use(function (req, res, next) {
    next();
});

// Start server
app.listen(PORT, function () {
    console.log('Server listening on port ' + PORT + '\n');
});

// Serve frontend
app.use("/", express.static(__dirname + '/public'));
console.log('\x1b[36m%s\x1b[0m',"Static Path Set to " + __dirname + '/public');

/**
 * Business Logic
 */
const breakThreshold = 1;
var clientMessageCount = 0;
var timeCheck;

client.on('connect', function () {
    client.subscribe("healthyoffice/rpi");
});

client.on('message', function(topic, message) {
    message = JSON.parse(message.toString());
    clientMessageCount++;
    businessLogic(message);
});


function businessLogic(message) {
    var distance1 = message.distances.distance1;
    var distance2 = message.distances.distance2;
    var clientTime = message.timestamp;

    if (distance1 > threshold && distance2 > threshold) {
        console.log("Took a break");
        sendDatabase("Lakindu/TookBreak/",distance1,distance2,clientTime);
        timeCheck = getTime();
    } else {
        sendDatabase("Lakindu/NeedBreak/",distance1,distance2,clientTime);
    }

    processBreaks(distance1, distance2);
}

function processBreaks(distance1, distance2){
    console.log("Client Messages: " + clientMessageCount);
    if (timeCheck == null || (distance1 > threshold && distance2 > threshold)) {
        //program started or guy just took a break
        timeCheck = getTime();
    } else if (moment(getTime()).diff(timeCheck, 'minutes') >= breakThreshold) {
        console.log("Need a break!" + " Time since last break: " + moment(getTime()).diff(timeCheck, 'minutes'));
        sendEmail("Watch Out!","You need to take a break");
    }
}

function getTime(){
    return moment().format();
}

function sendDatabase(dbName, payload1, payload2, clientTime) {
    var timeNow = getTime();
    var ref = db.ref(dbName+timeNow);
    ref.set({distance1:payload1, distance2:payload2, clientTime:clientTime});
}

function sendEmail(subject,message) {
    var mailOptions = {
        from: '"Healthy Office" <lakindu@surfedge.lk>', // sender address
        to: 'vihanga123@gmail.com , lakindu1995@gmail.com',// list of receivers
        subject: subject, // Subject line
        text: message, // plain text body
        html: '' // html body
    };
    if (!debug){
        transporter.sendMail(mailOptions, function(error,info) {
            if (error) {
                return console.log(error);
            }
            console.log('Message %s sent: %s', info.messageId, info.response);
        });
    }
}
