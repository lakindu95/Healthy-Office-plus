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

var transporter = nodemailer.createTransport({
    host: 'localhost',
    port: 3000, //mailcone
    auth: {
        user: 'lakindu',
        pass: '1234'
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
    console.log('Server listening on port ' + PORT);
});

// Serve frontend
app.use("/", express.static(__dirname + '/public'));
console.log('\x1b[36m%s\x1b[0m',"Static Path Set to " + __dirname + '/public');

client.on('connect', function () {
    client.subscribe("healthyoffice/rpi");
});

client.on('message', function(topic, message) {
    message = JSON.parse(message.toString());
    businessLogic(message);

});

function businessLogic(message) {
    var distance1 = message.distance1;
    var distance2 = message.distance2;

    if (distance1 > threshold && distance2 > threshold) {
        console.log("Sending email...");
        sendDatabase();
        updateFrontend();
        sendEmail("Good Job!","You just took a break");
    } else {
        console.log("Sending email...");
        sendEmail("Watch Out!","You need to take a break");
    }
}

function updateFrontend() {
    //Websockets: update
}

function sendDatabase() {

}

function sendEmail(subject,message) {
    var mailOptions = {
        from: '"Healthy Office" <damian@surfedge.lk>', // sender address
        to: 'lakindu@surfedge.lk, damian@surfedge.lk', // list of receivers
        subject: subject, // Subject line
        text: message, // plain text body
        html: '' // html body
    };

    transporter.sendMail(mailOptions, function(error,info) {
        if (error) {
            return console.log(error);
        }
        console.log('Message %s sent: %s', info.messageId, info.response);
    });
}