var orm = require("orm");

var db_config = {
	host: 'localhost',
	user: 'root',
	password: 'rootpass'
};

var db = undefined

var isCreatingDatabase = false
var createdTablesNumber = 0
var generateTables = false
var dbUseRequested = true

var eventTables = {}
var sessionTable = undefined
var dbName = 'trackjs'
var connection;
var dbTypes = {
	"TINYINT" : Number,
	"SMALLINT" : Number,
	"MEDIUMINT" : Number,
	"BIGINT" : Number,
	"VARCHAR(512)" : String,
	"TINYTEXT" : String,
	"MEDIUMTEXT" : String,
	"LONGTEXT" : Object
}

function DBEvent(_name, _needToBeCompacted, model)
{
	this.name = _name
	this.model = model
	this.needToBeCompacted = _needToBeCompacted
	this.isTableDone = false
	eventTables[_name] = this
};

function handleError(action, err)
{
	if (err)
		console.error('Failed to ' + action + '. Reason : ' + err)
}

function isFullyConnected() {
	if (createdTablesNumber == exports.getNbEventsDef() + 1) //+1 for session table
	{
		return (true)
	}
	return (false)
}

function generateTable(name, rows, isCached, create) {
	var ormDefinition = {}
	var sqlReq = "CREATE TABLE IF NOT EXISTS " + name + " ("

	sqlReq += "id int NOT NULL AUTO_INCREMENT,"
	for (row in rows)
	{
		ormDefinition[row] = dbTypes[rows[row]]
		if (create)
		{
			sqlReq += row + " " + rows[row]
			sqlReq += ","
		}
	}
	sqlReq += "PRIMARY KEY (ID))"
	if (create)
	{
		db.driver.execQuery(sqlReq, function(err, data) {
			handleError("generate table " + name, err)
			if (!err) {
				createdTablesNumber += 1
				console.log('Created table ' + name)
			}
		})
	}
	else
		createdTablesNumber += 1
	return db.define(name, ormDefinition, {cache : isCached})
}

exports.init = function init() {
	if (isCreatingDatabase != true && dbUseRequested == true) //called manually if db creation requested
	{
	orm.connect('mysql://' + db_config.user + ':' + db_config.password + '@' + db_config.host + '/' + dbName + '?bigNumberStrings=true', function (err, _db) {
	db = _db
	if (err) { console.error('mysql connexion error : make sure a mysql server in up and running, and that necessary database is present'); throw err; }
		sessionTable = generateTable("sessions", {
			ip				: "MEDIUMTEXT",
			initialTime		: "BIGINT",
			url				: "MEDIUMTEXT",
			screenWidth		: "MEDIUMINT",
			screenHeight	: "MEDIUMINT",
			viewportWidth	: "MEDIUMINT",
			viewportHeight	: "MEDIUMINT",
			browserPosX		: "MEDIUMINT",
			browserPosY		: "MEDIUMINT",
			browserHeight	: "MEDIUMINT",
			lang			: "TINYTEXT",
			browserName		: "MEDIUMTEXT",
			browserVersion	: "TINYTEXT",
			initialScrollX	: "SMALLINT",
			initialScrollY	: "SMALLINT",
			tag				: "MEDIUMTEXT",
			html			: "MEDIUMTEXT"
		}, false, generateTables);
		var mouseclic = generateTable("mouseclic", {
			sessionId	: "MEDIUMINT",
			x			: "MEDIUMINT",
			y			: "MEDIUMINT",
			date		: "BIGINT"
		}, false, generateTables);
		var mousetick = generateTable("mousetick", {
			sessionId	: "MEDIUMINT",
			data		: "LONGTEXT"
		}, false, generateTables);
		var scrolltick = generateTable("scrolltick", {
			sessionId	: "MEDIUMINT",
			data		: "LONGTEXT"
		}, false, generateTables);
		var formchange = generateTable("formchange", {
			sessionId	: "MEDIUMINT",
			element_id	: "MEDIUMTEXT",
			element_name : "MEDIUMTEXT",
			val			: "MEDIUMTEXT",
			date		: "BIGINT"
		}, false, generateTables);
		var formset = generateTable("formset", {
			sessionId	: "MEDIUMINT",
			element_id	: "MEDIUMTEXT",
			element_name : "MEDIUMTEXT",
			val			: "MEDIUMTEXT",
			date		: "BIGINT"

		}, false, generateTables);
		var resize = generateTable("resize", {
			sessionId	: "MEDIUMINT",
			viewportWidth	: "BIGINT",
			viewportHeight : "BIGINT",
			date		: "BIGINT"

		}, false, generateTables);
		var keypress = generateTable("keypress", {
			sessionId	: "MEDIUMINT",
			keyCode		: "TINYTEXT",
			date		: "BIGINT"
		}, false, generateTables);
		var focus = generateTable("focus", {
			sessionId	: "MEDIUMINT",
			element_id	: "MEDIUMTEXT",
			element_name : "MEDIUMTEXT",
			date		: "BIGINT"
		}, false, generateTables);
		var blur = generateTable("blur", {
			sessionId	: "MEDIUMINT",
			element_id	: "MEDIUMTEXT",
			element_name : "MEDIUMTEXT",
			date		: "BIGINT"
		}, false, generateTables);
		var windowmove = generateTable("windowmove", {
			sessionId	: "MEDIUMINT",
			x			: "MEDIUMINT",
			y 			: "MEDIUMINT",
			topMargin	: "MEDIUMINT",
			browserHeight : "MEDIUMINT",
			date		: "BIGINT"
		}, false, generateTables);
		var disconnected = generateTable("disconnected", {
			sessionId	: "MEDIUMINT",
			date		: "BIGINT"
		}, false, generateTables);
		new DBEvent('mouseclic', false, mouseclic);
		new DBEvent('mousetick', true, mousetick);
		new DBEvent('scrolltick', true, scrolltick);
		new DBEvent('formset', false, formset);
		new DBEvent('formchange', false, formchange);
		new DBEvent('resize', false, resize);
		new DBEvent('keypress', false, keypress);
		new DBEvent('focus', false, focus);
		new DBEvent('blur', false, blur);
		new DBEvent('windowmove', false, windowmove);
		new DBEvent('disconnected', false, disconnected);
	});
	}
}
exports.generateDB = function() {
	console.log('Generating databases...')

	generateTables = true
	isCreatingDatabase = true
	orm.connect('mysql://' + db_config.user + ':' + db_config.password + '@' + db_config.host + '/' + '?bigNumberStrings=true', function (err, _db) {
		if (err) { console.error('mysql connexion error : make sure a mysql server is up and running, and that db_config is set correctly'); throw err; }
		isCreatingDatabase = false
		db = _db
		db.driver.execQuery('CREATE DATABASE IF NOT EXISTS ' + dbName, function(err, data) {
			handleError("create database " + dbName, err);
			if (err)
				throw err;
			exports.init()
			console.log('Database created')
		})
	});
}
exports.noDB = function() {
	console.log('No database connexion')

	dbUseRequested = false
}

exports.storeSession = function(session) {
	var sessionDbId = undefined
	var addAtTheEnd = {}

	if (isFullyConnected())
	{
		sessionTable.create([
		{
			ip: session.ip, 
			initialTime: session.initialTime, 
			url: session.url, 
			screenWidth: session.initialData.screenWidth, 
			screenHeight: session.initialData.screenHeight, 
			viewportWidth: session.initialData.viewportWidth, 
			viewportHeight: session.initialData.viewportHeight, 
			browserPosX: session.initialData.browserPosX, 
			browserPosY: session.initialData.browserPosY, 
			browserHeight: session.initialData.browserHeight, 
			lang: session.initialData.lang, 
			browserName: session.initialData.browserName, 
			browserVersion: session.initialData.browserVersion, 
			initialScrollX: session.initialData.initialScrollX, 
			initialScrollY: session.initialData.initialScrollY, 
			tag: session.tag, 
			html: session.html
		}], function (err, items) {
			if (err)
				handleError("storing session", err)
			else
			{
				sessionDbId = items[0].id
				for (e in session.eventsList) {
					if ((eventTables[session.eventsList[e].e] != undefined))
					{
						//register event

						if (eventTables[session.eventsList[e].e].needToBeCompacted == false)
						{
							session.eventsList[e].d.sessionId = sessionDbId
							eventTables[session.eventsList[e].e].model.create([session.eventsList[e].d], function (err, items) { handleError("Failed registering event " + session.eventsList[e].e, err) })
						}
						else
						{
							if (addAtTheEnd[session.eventsList[e].e] == undefined)
								addAtTheEnd[session.eventsList[e].e] = new Array()
							addAtTheEnd[session.eventsList[e].e].push(session.eventsList[e].d)
						}
					}
				}
				// add '''''''compressed''''''' data
				for (toAdd in addAtTheEnd)
				{
					eventTables[toAdd].model.create([
					{
						sessionId: sessionDbId,
						data: addAtTheEnd[toAdd]
					}], function (err, items) {})
				}

			}
		})
	}
}

function callbackEvents(_sessionId, eventName, callback)
{
	//check here
	eventTables[eventName].model.find({ sessionId: _sessionId }, function (err, eventObj) {

		if (err)
			handleError("getting event of type " + eventName, err)
		else if (eventTables[eventName].needToBeCompacted == true)
		{
			var retEvents = new Array()

			if (eventObj[0] != undefined)
				for (e in eventObj[0].data)
				{
					retEvents.push(eventObj[0].data[e])
				}
			callback(retEvents, _sessionId, eventName);
		}
		else
			callback(eventObj, _sessionId, eventName);
	});
}

exports.getPastSessionEvents = function(_sessionId, callback) {
	if (isFullyConnected())
	{
		sessionTable.get(_sessionId, function(err, sessionObj) {
			if (err)
				handleError("getting session", err)
			else
			{
				callback(sessionObj, _sessionId, 'initialData');
				for (e in eventTables)
				{
					callbackEvents(_sessionId, e, callback)
				}
			}
		});
	}
}

exports.getPastSessions = function(callback) {
	if (isFullyConnected())
	{
		sessionTable.find({},[ "id", "Z" ]).only('id', 'ip', 'initialTime', 'url', 'screenWidth', 'screenHeight', 'viewportWidth', 'viewportHeight', 'lang', 'browserName', 'browserVersion', 'initialScrollX', 'initialScrollY', 'tag').limit(20).run(function (err, pastSessions) {
			if (err)
				handleError("getting past sessions", err)
			callback(pastSessions);
		});
	}
}

exports.getNbEventsDef = function() {
	return Object.keys(eventTables).length
}

