//Grab packages
var http = require('http');
var fs = require('fs');
var express = require('express');
var bodyParser = require('body-parser');
var mysql = require("mysql");
// var json = require('json');

//Temp ductape to prevent server shutdown on databse error
process.on('uncaughtException', function(err) {
    console.error(err);
    console.log("Node NOT Exiting...");
});

//express initialization
var app = express();
var port = process.env.PORT || 3000;

//body-parser initialization
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

//Initialize MySQL connection
var con = mysql.createConnection({
    host: "localhost",
    user: "{user}",
    password: "{password}"
})

con.connect(function(err) {
    if (err) {
        console.log("Error connecting to database");
        return;
    }

    console.log("Database connection established");

})

/**
Global Vars
**/
//Units defined
var humidityUnitDefined = 'percent';
var temperatureUnitDefined = 'fahrenheit';

//Error code defined
var INCORRECT_UNIT = -1;

/**
End Global Vars
**/

//Routes will go here

app.post('/api/readings', function(req, res) {

    var temp = convertToFloat(req.body.temperature);
    var humidity = convertToFloat(req.body.humidity);

    var tempUnit = verifyTemperatureUnit(req.body.temperature_unit);
    var humidityUnit = verifyHumidityUnit(req.body.humidity_unit);

    //var result = 'temp: ' + temp + tempUnit + '\nhumidity: ' + humidity + humidityUnit;
    //console.log(result);
    res.send("");

    insertHumidityReading(humidity, humidityUnit);
    insertTemperatureReading(temp, tempUnit)

});

//Start server
app.listen(port);
console.log('Server started at localhost:' + port);



//TODO for both humidity and temp check, find way to save both sets of data if error is thrown
//TODO create error handling where I will be notified via (email?) about errors
/**
We want to ensure the correct units are being passed to the DB
Returns global var INCORRECT_UNIT if given unit is incorrect
**/
function verifyHumidityUnit(postUnit) {
    if (postUnit.trim() == humidityUnitDefined) {
        return humidityUnitDefined;
    } else {
        console.log("Incorrect unit passed for humidity");
        return INCORRECT_UNIT;
    }
}
/**
We want to ensure that the correct units will be passed to the DB
Returns global var INCORRECT_UNIT if given unit is incorrect
if parameter is valid, returns predefined unit 
**/
function verifyTemperatureUnit(postUnit) {
    if (postUnit.trim() == temperatureUnitDefined) {
        return temperatureUnitDefined;
    } else {
        console.log("Incorrect unit passed for temperature");
        return INCORRECT_UNIT;
    }
}
/**
Converts string to a float. If an invalid parameter is passed, then an exception is thrown.

parameter postValue - string to convert to float

if parameter is valid, returns predefined unit

**/
function convertToFloat(postValue) {

    var result = parseFloat(postValue);

    if (isNaN(postValue)) {
        throw new Error("Error when parsing the value " + postValue + " to a number");
    }

    return result;
}


/**
DB Setup

	CREATE TABLE rawTemperatureReading (
		insert_id int NOT NULL AUTO_INCREMENT,
		temperature_reading DECIMAL(6,3) NOT NULL,
		temperature_unit varchar(16) NOT NULL,
		insert_timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
		PRIMARY KEY (insert_id)
	);

	CREATE TABLE rawHumidityReading (
		insert_id int NOT NULL AUTO_INCREMENT,
		humidity_reading DECIMAL(6,3) NOT NULL,
		humidity_unit varchar(16) NOT NULL,
		insert_timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
		PRIMARY KEY (insert_id)
	);

//TODO
Table: outsideTemperatureReading
Table: outsideHumidityReading


**/

/**
Records the RAW data of the arduino's humidity reading into the database. Note that this does NOT account for the ~+5% needed to be
added to humidity to get the accurate percentage. 

parameter: humidity reading

**/
function insertHumidityReading(humidityReadingParam, humidityUnitParam) {
    //Param checking
    if (isNaN(humidityReadingParam)) {
        throw new Error("Error when passing insert parameter to humidity reading insert: paramter " + humidityReadingParam + " is not a number");
    }
    if (typeof humidityReadingParam == 'undefined') {
        throw new Error("Error when passing insert parameter to humidity reading insert: paramter humidityReadingParam is undefined.");
    }

    if (typeof humidityUnitParam == 'undefined') {
        throw new Error("Error when passing insert parameter to humidity reading insert: paramter humidityUnitParam is undefined.");
    }

    var humidityInsert = { humidity_reading: humidityReadingParam, humidity_unit: humidityUnitParam };
    con.query('INSERT INTO mjmonitor.rawHumidityReading SET ?', humidityInsert, function(err, rows) {

        if (err) {
            writeDataToFile(humidityReadingParam, humidityUnitParam);
            console.log(err);
            throw err;
        }

        //console.log('Data received from Db:');
        console.log('Humidity reading ID: ' + rows.insertId);
    });
}


/**
Records the RAW data of the arduino's temperature into the database. Note that this does NOT account for the ~+5% needed to be
added to humidity to get the accurate percentage. 

parameter: temperature reading

**/
function insertTemperatureReading(tempReadingParam, tempUnitParam) {

    //Param checking
    if (isNaN(tempReadingParam)) {
        throw new Error("Error when passing insert parameter to temperature reading insert: paramter " + tempReadingParam + " is not a number");
    }

    if (typeof tempReadingParam == 'undefined') {
        throw new Error("Error when passing insert parameter to temperature reading insert: paramter tempReadingParam is undefined.");
    }

    if (typeof tempUnitParam == 'undefined') {
        throw new Error("Error when passing insert parameter to temperature reading insert: paramter tempReadingParam is undefined.");
    }

    var temperatureInsert = { temperature_reading: tempReadingParam, temperature_unit: tempUnitParam };
    con.query('INSERT INTO mjmonitor.rawTemperatureReading SET ?', temperatureInsert, function(err, rows) {

        if (err) {
            writeDataToFile(tempReadingParam, tempUnitParam);
            console.log(err);
            throw err;
        }

        //console.log('Data received from Db:\n');
        console.log('Temperature reading ID: ' + rows.insertId);
    });

}

/**
In case the database is unavailable, we dont want to throw out this data. Thus we will write it to file.
**/
function writeDataToFile(reading, unit) {

    //The arguous task of making a MySQL-friendly timestamp. There's probably a library for this.
    var basedate = new Date();
    var yearNow = basedate.getFullYear()
    var monthNow = basedate.getMonth();
    var dayNow = basedate.getDate();
    var hourNow = basedate.getHours();
    var minuteNow = basedate.getMinutes();
    var secondNow = basedate.getSeconds();
    var timestamp = yearNow + '-' + monthNow + '-' + dayNow + ' ' + hourNow + ':' + minuteNow + ':' + secondNow;

    var dataToAppend = reading + ',' + unit + ',' + timestamp + '\n';

    fs.appendFile(require('path').resolve(__dirname, 'backup.csv'), dataToAppend, function(err) {
        if (err) throw err;
    });

    console.log("ERROR: data written to emergency backup file. Figure out whats wrong!");

}
