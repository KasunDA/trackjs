var db = require("./db.js");
var adminPass = 'adminpass'

var ioClient = require('socket.io').listen(7455).set('log level', 2);
var ioAdmin = require('socket.io').listen(7456).set('log level', 2);
var http = require('http')
var sessions = {};
var argumentsActions = { "--generate-db" : db.generateDB,
						 "--no-db" : db.noDB }
var maxClients = 64
var clientNb = 0
var exec = true

function Session(ip)
{
	this.ip = ip;
	this.url = '';
	this.initialData = {};
	this.initialTime = new Date().getTime() - 100;
	this.trackers = {}
	this.tag = undefined
	this.html = undefined
	this.eventsList = {}

	this.transmit = function (session, eventName, data) {
		if (data == undefined)
			data = { date : new Date().getTime() }
		while (this.eventsList[data.date] != undefined)
			data.date = data.date + 1 //'0'
		this.eventsList[data.date] = { e: eventName, d: data}
		for (sock in session.trackers)
		{
			ioAdmin.sockets.sockets[sock].emit(eventName, data)
		}
	};
}

process.argv.forEach(function(val, index, array) {
	if (index > 1)
	{
		if (argumentsActions[val] != undefined)
		{
			(argumentsActions[val])()
		}
	}
});

db.init()

ioClient.sockets.on('connection', function (socket) {
	var session = new Session(socket.handshake.address.address)
	var sessionHash = socket.id
	var newSession = true
	clientNb++

	sessions[sessionHash] = session

	socket.on('mousetick', function (data) {
		session.initialData.initialMouseX = data.x
		session.initialData.initialMouseY = data.y
		session.transmit(session, 'mousetick', data)
	});
	socket.on('scrolltick', function (data) {
		session.initialData.initialScrollX = data.x
		session.initialData.initialScrollY = data.y
		session.transmit(session, 'scrolltick', data)
	});
	socket.on('mouseclic', function (data) {
		session.transmit(session, 'mouseclic', data)
	});
	socket.on('initialdata', function (data) {
		var sessionsToTransfer = { };

		session.initialData = data
		session.url = data.url
		session.tag = data.tag

		console.log('New session at ' + data.url)
		sessionsToTransfer[sessionHash] = session
		if (newSession == true)
		{
			ioAdmin.sockets.in('connected_admins').emit('coClient', { sessionList : sessionsToTransfer})
			newSession = false
		}
		session.transmit(session, 'initialdata', data)
	});
	socket.on('keypress', function (data) {
		session.transmit(session, 'keypress', data)
	});
	socket.on('resize', function (data) {
		session.transmit(session, 'resize', data)
	});
	socket.on('focus', function (data) {
		session.transmit(session, 'focus', data)
	});
	socket.on('blur', function (data) {
		session.transmit(session, 'blur', data)
	});
	socket.on('formchange', function (data) {
		session.transmit(session, 'formchange', data)
	});
	socket.on('formset', function (data) {
		session.transmit(session, 'formset', data)
	});
	socket.on('windowmove', function (data) {
		session.transmit(session, 'windowmove', data)
	});
	socket.on('pageHtml', function (data) {
		data.html = data.html.replace('<head>', '<head><base href="http://' + session.url.split('/')[2] + '/" />').replace(/<script/g, '<!--<script').replace(/<\/script>/g, '</script>-->')
		session.html = data.html
		session.transmit(session, 'pageHtml', data)
	});

	socket.on('disconnect', function () {
		var sessionsToTransfer = { };

		clientNb--
		sessionsToTransfer[sessionHash] = session
		ioAdmin.sockets.in('connected_admins').emit('decoClient', { sessionList : sessionsToTransfer})
		session.transmit(session, 'disconnected', undefined)
		session.trackers = {}

		if (session != undefined && session.url != undefined && session.url != '' && session.ip != undefined)
			db.storeSession(session)

		delete sessions[sessionHash]
	});
});

ioClient.configure(function (){
	ioClient.set('authorization', function (handshakeData, callback) {
		if (clientNb + 1 > maxClients)
			callback("Maximum client number is reached", false);
		else
			callback(null, true);
	});
});

ioAdmin.sockets.on('connection', function (socket) {
	var loggedIn = false
	var sessionHash = socket.id
	var sessionRequested = {}
	var following = {}

	socket.on('login', function (data) {
		if (data.pass == adminPass)
		{
			loggedIn = true
			socket.join('connected_admins')
			socket.emit('authentificationResult', { authSuccess: true })
		}
		else
		{
			socket.emit('authentificationResult', { authSuccess: false })
			return ;
		}

		socket.on('reqSessionList', function (data) {
			socket.emit('coClient', { sessionList: sessions });
		});

		socket.on('reqPastSessionEvents', function (data) {
			function gotDBPastSessionEvents(rows, id, eventName) {

				var pastEvents = {}
				sessionRequested[id].requestsDone++
				if (eventName == 'initialData')
				{
					sessionRequested[id].initialTime = rows.initialTime
					sessionRequested[id].initialData = rows
					sessionRequested[id].html = rows.html
					sessionRequested[id].initialData.html = undefined
					sessionRequested[id].url = rows.url
					sessionRequested[id].tag = rows.tag
					sessionRequested[id].ip = rows.ip
					delete sessionRequested[id].initialData.html
				}
				else if (rows.length > 0)
				{
					for (var i = 0 ; i < rows.length ; i++)
					{
						if (eventName != 'initialData')
						{
							var time;

							if (isNaN(rows[i].date) || rows[i].date == undefined)
								rows[i].date = 0
							while (sessionRequested[id].eventsList[rows[i].date] != undefined)
								rows[i].date = rows[i].date + 1
							sessionRequested[id].eventsList[rows[i].date] = {}
							sessionRequested[id].eventsList[rows[i].date].data = {}
							sessionRequested[id].eventsList[rows[i].date].data = rows[i]
							sessionRequested[id].eventsList[rows[i].date].e = eventName
							if (sessionRequested[id].sessionDuration == -1 || sessionRequested[id].eventsList[rows[i].date].data.date > sessionRequested[id].sessionDuration)
								sessionRequested[id].sessionDuration = sessionRequested[id].eventsList[rows[i].date].data.date
							sessionRequested[id].eventsList[rows[i].date].data.date -= sessionRequested[id].initialTime
						}
					}
				}
				if (sessionRequested[id].requestsDone == db.getNbEventsDef() + 1) //+1 for additional sesion initial data
				{
					delete sessionRequested[id].requestsDone
					socket.emit('pastSessionEvents', { pastSession: sessionRequested[id] });
					delete sessionRequested[id]
				}
			}
			sessionRequested[data.id] = undefined
			sessionRequested[data.id] = new Session("Unknown")
			sessionRequested[data.id].requestsDone = 0
			sessionRequested[data.id].sessionDuration = -1
			db.getPastSessionEvents(data.id, gotDBPastSessionEvents)
		});

		socket.on('reqPastSessionList', function (data) {
			function gotDBSessionList(rows) {
				var pastSessions = {}

				for (var i = 0 ; i < rows.length ; i++)
				{
					pastSessions[rows[i].id] = new Session(rows[i].ip)
					pastSessions[rows[i].id].url = rows[i].url
					pastSessions[rows[i].id].tag = rows[i].tag
					pastSessions[rows[i].id].initialTime = rows[i].initialTime


					pastSessions[rows[i].id].initialData = { screenWidth: rows[i].screenWidth, screenHeight: rows[i].screenHeight,
											viewportWidth: rows[i].initialViewportWidth, viewportHeight: rows[i].initialViewportHeight,
											browserName: rows[i].browserName, browserVersion: rows[i].browserVersion,
											initialScrollX: rows[i].initialScrollY, initialScrollY: rows[i].initialScrollY,
											lang: rows[i].lang, date: rows[i].initialTime,
											tag: rows[i].tag, }
				}
				socket.emit('pastSessionsList', { sessionList: pastSessions });
			}
			db.getPastSessions(gotDBSessionList)
		});

		socket.on('reqSessionData', function (data) {

		});

		socket.on('follow', function (data) {
			if (sessions[data.hash] != undefined)
			{
				var session = { }
				session[data.hash] = sessions[data.hash]
				socket.emit('updateClient', { sessionList: session });

				sessions[data.hash].trackers[sessionHash] = ''
				following[data.hash] = ''
				socket.emit('initialdata', sessions[data.hash].initialData)
				if (sessions[data.hash].html != undefined)
					socket.emit('pageHtml', { html : sessions[data.hash].html })
			}
		});

		socket.on('unfollow', function (data) {
			if (sessions[data.hash] != undefined)
			{
				delete sessions[data.hash].trackers[sessionHash]
				delete following[data.hash]
			}
		});

	});
	socket.on('disconnect', function () {
		for (key in following)
			if (sessions[key] != undefined)
				delete sessions[key].trackers[sessionHash]
	});
});


