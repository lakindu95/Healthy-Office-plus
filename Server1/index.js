
/**
 * Created by Vihanga Bandara on 08-Apr-17.
 */
const express = require('express');  // a light weight web framework
const http = require('http'); //http server
const PORT = 3000; // port number
const mqtt = require('mqtt'); // in order to use mqtt protocols to subscribe and publish we require this
const mqttbroker = "tcp://iot.eclipse.org"; //this is the public server of the mqtt broker
const bodyParser = require('body-parser'); //extracts the entire body of the request and then exposes it in req.body
const client = mqtt.connect(mqttbroker); //connect to the mqtt broker using mqtt.connect
const threshold =22 ; //this is the highest value before the server realises a person is not at his/her seat
const nodemailer = require('nodemailer'); //module which is used to send mails
const moment = require('moment'); //module from which can get currentdatetime
const debug = false; //if mail is not sent
const admin = require("firebase-admin"); //module needed to connect to firebase
const serviceAccount = require("./firebase/serviceKey.json"); //serviceaccount key
const Spinner = require('cli-spinner').Spinner; //spinner object
var winston = require('winston');
var spinner;
//setting up log file using library winston logger



 function stopSpin()      {
        spinner.stop();  
    }
    function startSpin()     {
        spinner = new Spinner('processing.. %s');
        spinner.setSpinnerString("|/-\\");
        spinner.start();
    }
 
winston.add(
  winston.transports.File, {
    filename: 'Healthyoffice.log',
    level: 'info',
    json: true,
    eol: '\r\n', // for Windows, or `eol: ‘n’,` for *NIX OSs
    timestamp: true
  }
)
 



//connecting firebase using default firebase access method and code and sending the serviceAccount as a paramenter
admin.initializeApp({ 
    credential: admin.credential.cert(serviceAccount),
    databaseURL: "https://healthy-office-2.firebaseio.com" //chnged database
});

const db = admin.database(); //variable to access database in firebase admin

var transporter = nodemailer.createTransport({ //creates transporter object and setup email data
    host: 'mail.mailcone.com',
    port: 587, //local mail
    auth: {
        user: 'lakindu@surfedge.lk',
        pass: 'piumi'
    }
});

const app = express();  //initalize express framework and make it available using this 'app' variable
const router = express.Router(); //make routing available using this variable
app.use("/", router); //mounts the middleware..havent specified and to use the router
app.use(bodyParser.json());       // to support JSON-encoded bodies // parses to JSON
app.use(bodyParser.urlencoded({     // to support URL-encoded bodies // parse to urlencoded
    extended: true //can be a string or an array if false can be any type
}));
app.use(bodyParser.text()); //reads buffer as plain text
app.use(bodyParser.raw()); //exposes buffered up content in a buffer
router.use(function (req, res, next) { //it uses the express routing ability to get request and responses and to move on to the next req we use next()
    next();
});

// Start server
app.listen(PORT, function () {
    
startSpin();
    winston.log('info','Server listening on port ' + PORT + '\n');

});

// Server frontend in this where we include external CSS JS
app.use("/", express.static(__dirname + '/public'));
winston.log('info','\x1b[36m%s\x1b[0m',"Static Path Set to " + __dirname + '/public');

/**
 * Business Logic
 */
var clientMessageCount = 0;
var timeCheck;
var firstTime=false;
var isSeated=false;
var startTime=0;
var endTime=moment();



client.on('connect', function () {
    client.subscribe("healthyoffice/rpi");
});

client.on('message', function(topic, message) {
    message = JSON.parse(message.toString());
    clientMessageCount++;
    businessLogic(message);
});


function businessLogic(message) {
   stopSpin();
    var distance1 = message.distance1;
    var distance2 = message.distance2; 
    // var clientTime = message.timestamp;
    var clientTime = moment();  

    //runs only at the beginning of the server
    if(!firstTime){
        console.log("info","No person has been detected at seat");
    }

    if ((distance1 > threshold) && (distance2 > threshold) && (!isSeated) && (firstTime)) {
        winston.log("info","User has taken a break");
        endTime=moment(); //since user has taken a break
        startTime = clientTime;
        isSeated=true;
    } else if((distance1 < threshold) && (distance2 < threshold) && (!isSeated) && (!firstTime)){
        winston.log("info","User has been detected");
        firstTime=true;
        endTime=clientTime; //check for difference in first instance of user sitting down

    } else if((distance1 < threshold) && (distance2 < threshold) && (isSeated)){
         winston.log("info","User has returned to seat");
        endTime=clientTime; //check for difference every other time after first instance
        getDuration();
        isSeated=false;

    }
       
    getMail(); //function call to send mail to the user

    processBreaks(distance1, distance2); //function call
}

//get time differences 
function getDuration(){

   
    var difference = moment.utc(moment(endTime,"DD/MM/YYYY HH:mm:ss").diff(moment(startTime,"DD/MM/YYYY HH:mm:ss"))).format("HH:mm:ss");   
    var minutes=difference.slice(3,5);
    var seconds=difference.slice(6,8);
     winston.log("info","User has stayed away for --> " + minutes + " minutes and "+ seconds +" seconds");
    startSpin();
    sendDatabase("IpBBEfCob0c1GaYkvAzog9rVdKn1/",difference);
}

function getMail(){

timeCheck = moment();
var difference = moment.utc(moment(timeCheck,"DD/MM/YYYY HH:mm:ss").diff(moment(endTime,"DD/MM/YYYY HH:mm:ss"))).format("ss");

if(difference==10 && (!isSeated)){
   startSpin();
    console.log("Sending Email...");
    sendEmail("Watch Out!","You need to take a break");
    winston.log("info","Email has been sent to user");
    var time = endTime.format("HH:mm:ss");
    winston.log("info","Need a Break!!"+" Time since last break : " + time);
}

}


//shows numbers of client messages received
function processBreaks(distance1, distance2){
    console.log("Client Messages : " + clientMessageCount + " --> Distance 1 : "+ distance1 +" Distance 2 : "+ distance2);
}

function getTime(){
    return moment().format();
}

//send database the time difference to be used in mobile application
function sendDatabase(dbName, payload1) {

  if(db.ref(dbName).push(payload1)){ //unique key and difference value
  winston.log('info', 'Sending to firebase successfull')
} else {
    
     winston.log('error', 'Sending not successfull');
}
stopSpin();
   //var ref = db.ref(dbName);
   // ref.update({difference:payload1});
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
                winston.log("error","Error sending email successfully")
                return console.log(error);
            }
            winston.log('info','Message %s sent: %s', info.messageId, info.response);
            
        });
    }
   stopSpin();
}