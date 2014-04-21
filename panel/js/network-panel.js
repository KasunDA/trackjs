var panel_config = {
	trackServer: 'localhost',
	trackPort: 7456
};

jQuery(function($) {
	if (typeof io === 'undefined')
	{
		$('body').html('<h2>No server connection</h2>')
		alert('Connection error, is the server up ?')
	}
	else {
	var socket = io.connect('http://' + panel_config.trackServer + ':' + panel_config.trackPort);
	var sessionList = $('#sessionList')
	var pastSessionList = $('#pastSessionList')
	var menu = $('#menu')
	var cursor = $('#viewer #cursor')
	var cursorNotifier = $('#viewer #cursor #clicNotifier')
	var userScreen = $('#viewer #userScreen')
	var userBrowser = $('#viewer #userBrowser')
	var iframe = $('#viewer #iframe')
	var eventList = $('#viewer #eventList')
	var progressBar = $('#progressBar')
	var progressBarProgress = $('#progressBarProgress')
	var replayControls = $('#replayControls')
	var pauseButton = $('#pauseButton')
	var backButton = $('#backButton')
	var cursorPos = { x: 0, y: 0}
	var scrollPos = { x: 0, y: 0}
	var viewerUrl = $('')
	var focusedElement = undefined
	var followedSession = undefined
	var followingCo = false
	var sessions = {}
	var followingHash = undefined
	var eventDef = { 'mouseclic': {func: onMouseClic, treatAsList: false, display: true, name: 'User clicked '},
					 'mousetick': {func: onMousetick, treatAsList: true, display: false, name: 'User moved mouse to'},
					 'scrolltick': {func: onScrolltick, treatAsList: false, display: true, name: 'User scrolled to'},
					 'formchange': {func: onChange, treatAsList: true, display: true, beginName: 'Starting changing form', endName: 'Finished, form is', executeIfBefore: onChange},
					 'formset': {func: onChange, treatAsList: false, display: true, name: 'Form is set at', executeIfBefore: onChange},
					 'resize': {func: onResize, treatAsList: true, display: true, beginName: 'Started resizing window', endName: 'Finished resizing window', executeIfBefore: onResize},
					 'keypress': {treatAsList: false, display: true, name: 'User typed'},
					 'focus': {func: onFocus, treatAsList: false, display: true, name: 'User focused', executeIfBefore: onFocus},
					 'blur': {func: onBlur, treatAsList: false, display: false, executeIfBefore: onBlur},
					 'windowmove': {func: onWindowMove, treatAsList: false, display: true, executeIfBefore: onWindowMove},
					 'disconnected': {func:onDisconnected, treatAsList: false, display: true, name: 'User disconnected'},
	}
	var lastEventName = undefined
	var lastEventArgs = undefined
	var eventPlayerTimer = undefined
	var eventPlayerTime
	var eventPlayerPaused
	setLoginUI()

	function newSession(sessionHash, isLive, ip, url, browserName, browserVersion, tag) {
		var sessionListDestination

		if (isLive)
			sessionListDestination = sessionList
		else
			sessionListDestination = pastSessionList
		sessionListDestination.append('<a href="" id="' + sessionHash + '"><li>' + ip + '<br />' + url + '<br />' + browserName + ' ' + browserVersion + '</li></a>')
		if (isLive)
			$('#' + sessionHash).click(function() { return (follow(sessionHash, tag)) });
		else
			$('#' + sessionHash).click(function() { socket.emit('reqPastSessionEvents', {id: sessionHash}); return false });

		if (followingHash != undefined)
			if (followingCo == false && ((tag != undefined && tag == sessions[followingHash].tag) || (ip != undefined && ip == sessions[followingHash].ip)))
				$('#' + sessionHash).click()
	}
	function follow(sessionHash, tag, ip) {
		setFollowUI()
		followingCo = true
		socket.emit('follow', { hash : sessionHash })
		followingHash = sessionHash
		return (false)
	}
	function gotEvent(e, d)
	{
		if (followingHash != undefined)
		{
			sessions[followingHash].eventsList[d.date] = { e: e, d: d }
			buildEventListElement(d.date)
		}
	}
	function addEvent(name, args, time, baseTime) {
		var date = new Date(parseInt(time) - baseTime)
		var html = '<li>' + date.getMinutes() + ':' + date.getSeconds() + ':' + date.getMilliseconds() + ' > ' + name

		for (argName in args)
		{
			if (argName != 'date')
				html += ' | ' + argName + ' : ' + args[argName]
		}
		html += '</li>'
		eventList.append(html)
		eventList.scrollTop(eventList[0].scrollHeight)
	}
	function buildEventListElement(t) {
		var eventName = sessions[followingHash].eventsList[t].e
		var eventData = sessions[followingHash].eventsList[t].d

		if (eventDef[eventName] != undefined)
		{
			var args = {}
			var display = eventDef[eventName].display

			if (eventDef[eventName].treatAsList == true && lastEventName == eventName)
				display = false

			args = eventData
			if (lastEventName != undefined && eventDef[lastEventName] != undefined && lastEventName != eventName && eventDef[lastEventName].treatAsList == true && eventDef[lastEventName].display == true)
			{
				args = lastEventArgs
				display = true
				addEvent(eventDef[lastEventName].endName, lastEventArgs, t, sessions[followingHash].initialTime)
			}
			if (display == true)
			{
				if (eventDef[eventName].treatAsList == true && lastEventName != eventName)
					addEvent(eventDef[eventName].beginName, eventData, t, sessions[followingHash].initialTime)
				else
					addEvent(eventDef[eventName].name, eventData, t, sessions[followingHash].initialTime)
			}
			lastEventName = eventName
			lastEventArgs = args
		}
	}
	function buildEventList() {
		for (t in sessions[followingHash].eventsList)
		{
			buildEventListElement(t)
		}
		eventList.animate({
			scrollTop: eventList[0].scrollHeight
		});
	}
	function rebuildEventList()	{
		eventList.children().remove()
		buildEventList()
	}

	$('#loginbox').submit(function (e) {
		socket.emit('login', { pass: $('#adminPasswordField').val() })
		e.preventDefault()
	})

	socket.on('authentificationResult', function (data) {
		if (data.authSuccess == true)
		{
			socket.emit('reqSessionList')
			socket.emit('reqPastSessionList')
			setSessionListUI()
		}
		else
		{
			$('#loginbox .error').hide()
			$('#loginbox .error').fadeIn()
		}
	});

	socket.on('decoClient', function (data) {
		for (key in data.sessionList)
		{
			$('#' + key).remove()
		}
	});
	socket.on('coClient', function (data) {
		for (key in data.sessionList)
		{
			sessions[key] = data.sessionList[key]
			newSession(key, true, data.sessionList[key].ip, data.sessionList[key].url, data.sessionList[key].initialData.browserName, data.sessionList[key].initialData.browserVersion, data.sessionList[key].tag)
		}
	});
	socket.on('pastSessionsList', function (data) {
		for (key in data.sessionList)
		{
			sessions[key] = data.sessionList[key]
			newSession(key, false, data.sessionList[key].ip, data.sessionList[key].url, data.sessionList[key].initialData.browserName, data.sessionList[key].initialData.browserVersion, data.sessionList[key].tag)
		}
	});
	function setTimeEventPlayer(advancement) {
		eventPlayerTime = Math.round(((sessions[followingHash].sessionDuration - sessions[followingHash].initialTime) * advancement), 0)
		onPageHtml(sessions[followingHash], true)
		onInitialData(sessions[followingHash].initialData)
	}
	function playEvents() {
		var t = sessions[followingHash].initialTime + eventPlayerTime
		var ft = t + 20

		updateProgressBar(sessions[followingHash].initialTime, ft, sessions[followingHash].sessionDuration)
		if (eventPlayerPaused || ft > sessions[followingHash].sessionDuration)
			return ;
		while (t < ft)
		{
			if (sessions[followingHash].eventsList[t] != undefined)
			{
				if (eventDef[sessions[followingHash].eventsList[t].e] != undefined && eventDef[sessions[followingHash].eventsList[t].e].func != undefined)
				{
					eventDef[sessions[followingHash].eventsList[t].e].func(sessions[followingHash].eventsList[t].data)
				}
			}					
			t++
		}
		eventPlayerTime += 20
	}
	function pauseEventPlayer() {
		eventPlayerPaused = !eventPlayerPaused
	}
	socket.on('pastSessionEvents', function (data) {
		followingHash = 0
		sessions[followingHash] = data.pastSession
		setReplayUI()

		onPageHtml({html: data.pastSession.html}, true)
		onInitialData(data.pastSession.initialData)

		eventPlayerTime = 0
		eventPlayerTimer = setInterval(playEvents, 20);
	});
	socket.on('updateClient', function (data) {
		for (key in data.sessionList)
		{
			sessions[key] = data.sessionList[key]
			rebuildEventList()
		}
	});
	function getFormElement(id, name)
	{
		if (id != '')
			return ($('#iframe').contents().find('#' + id))
		if (name != '')
			return ($('#iframe').contents().find('[name=' + name + ']').eq(0))
		return (undefined)
	}
	function onFocus(data) {
		focusedElement = getFormElement(data.element_id, data.element_name)
		if (focusedElement != undefined)
		{
			var borderStyle = focusedElement.css('border')
			focusedElement.css('border', '2px solid red')
			focusedElement.attr('prevBorderStyle', borderStyle + '')
			focusedElement.focus()
		}
	}
	socket.on('focus', function (data) {
		onFocus(data)
		gotEvent('focus', data)
	});
	function onWindowMove(data) {
		userBrowser.css('left', data.x + 'px')
		userBrowser.css('top', data.y + 'px')
		if (data.browserheight != undefined && data.browserheight != 0)
			userBrowser.height(data.browserheight)
		else
			userBrowser.css('height', 'auto')
		if (data.topMargin != undefined)
			userBrowser.css('padding-top', data.topMargin + 'px')
		else
			userBrowser.css('padding-top', '0px')
	}
	socket.on('windowmove', function (data) {
		onWindowMove(data)
		gotEvent('windowmove', data)
	});
	function onBlur(data) {
		bluredElement = getFormElement(data.element_id, data.element_name)
		if (focusedElement != undefined)
		{
			bluredElement.css('border', bluredElement.attr('prevBorderStyle') + '')
			bluredElement.blur()
		}
	}
	socket.on('blur', function (data) {
		onBlur(data)
		gotEvent('blur', data)
	});

	function onChange(data) {
		focusedElement = getFormElement(data.element_id, data.element_name)
		if (focusedElement != undefined)
			focusedElement.val(data.val)
	}
	socket.on('formchange', function (data) {
		onChange(data)
		gotEvent('formchange', data)
	});
	socket.on('formset', function (data) {
		onChange(data)
		gotEvent('formset', data)
	});
	socket.on('keypress', function (data) {
		gotEvent('keypress', data)
	});
	function onMouseClic(data) {
		cursorNotifier.css('display', 'block')
		setTimeout(function () {
			cursorNotifier.css('display', 'none')
		}, 270)
	}
	socket.on('mouseclic', function (data) {
		onMouseClic()
		gotEvent('mouseclic', data)
	});
	function onMousetick(data) {
		cursor.css('margin-left', data.x - iframe.contents().scrollLeft())
		cursor.css('margin-top', data.y - iframe.contents().scrollTop())
		gotEvent('mousetick', data)
	}
	socket.on('mousetick', onMousetick);

	function onScrolltick(data) {
		$('#iframe').contents().scrollLeft(data.x)
		$('#iframe').contents().scrollTop(data.y)
		scrollPos = { x: data.x, y: data.y}
	}
	socket.on('scrolltick', function (data) {
		onScrolltick(data)
		gotEvent('scrolltick', data)
	});

	function executeBeforeEvents(checkTime) {
		var eventName
		var eventTime

		if (followingHash != undefined)
			for (t in sessions[followingHash].eventsList)
			{
				eventName = sessions[followingHash].eventsList[t].e
				if (eventDef[eventName] != undefined && eventDef[eventName].executeIfBefore != undefined)
				{
					if (sessions[followingHash].eventsList[t].data == undefined)
						console.log(JSON.stringify(sessions[followingHash].eventsList[t]))
					eventTime = sessions[followingHash].eventsList[t].data.date
					if (checkTime == false || eventTime <= eventPlayerTime)
					{
						eventDef[eventName].executeIfBefore(sessions[followingHash].eventsList[t].data)
					}
				}
			}
		onScrolltick(scrollPos)
	}
	function onPageHtml(data, checkTimeForPrevEvents) {
		$('#iframe').attr('srcdoc', data.html).load(function () {
			executeBeforeEvents(checkTimeForPrevEvents)
		});
	}
	socket.on('pageHtml', function (data) {
		onPageHtml(data, false)
	});
	function onDisconnected() {
		$('#iframe').attr('srcdoc', '<h1 style="color: #121212">User disconnected</h1>')
	}
	socket.on('disconnected', function (data) {
		followingCo = false
		onDisconnected()
		gotEvent('disconnected', data)
	});
	function onResize(data) {
		iframe.attr('width', data.viewportWidth + 'px')
		iframe.attr('height', data.viewportHeight + 'px')
		userBrowser.width(data.viewportWidth)
	}
	socket.on('resize', function (data) {
		onResize(data)
		gotEvent('resize', data)
	});
	function onInitialData(data) {
		onResize(data)
		userScreen.width(data.screenWidth)
		userScreen.height(data.screenHeight)
		onWindowMove({ x: data.browserPosX, y: data.browserPosY, browserHeight: data.browserHeight})
		scrollPos = { x: data.initialScrollX, y: data.initialScrollY}
	}
	socket.on('initialdata', function (data) {
		onInitialData(data)
	});
	socket.on('disconnect', function () {
		console.error('Lost connection to the server')
	})
	socket.on('connect', function () {
		console.log('Got server connection')
	})

	//
	// UI
	//

	function setLoginUI() {
		$('#loginbox').show()
		menu.find('.options').hide()
		$('#userScreen').hide()
		cursor.hide()
		eventList.hide()
		iframe.hide()
		$('#sessions').css('height', '0px')
		replayControls.hide()
	}

	function setFollowUI() {
		$('#loginbox').hide()
		$('#sessions').css('height', '0px')
		$('#userScreen').show()
		menu.find('.options').show()
		eventList.show()
		cursor.show()
		iframe.show()
		replayControls.hide()
	}

	function setReplayUI() {
		$('#loginbox').hide()
		$('#sessions').css('height', '0px')
		$('#userScreen').show()
		menu.find('.options').show()
		eventList.show()
		cursor.show()
		iframe.show()
		replayControls.show()
		eventPlayerPaused = false
	}

	function setSessionListUI() {
		$('#loginbox').hide()
		$('#sessions').css('height', 'auto')
		$('#userScreen').hide()
		menu.find('.options').hide()
		cursor.hide()
		eventList.hide()
		iframe.hide()
		replayControls.hide()
	}

	function updateProgressBar(begin, now, end) {
		now -= begin
		end -= begin
		progressBarProgress.width(progressBar.width() - ((end - now) / end * progressBar.width()))
	}

	backButton.click(function() {
		if (followingHash != undefined)
			socket.emit('unfollow', { hash : followingHash })
		setSessionListUI()
	})

	pauseButton.click(function() {
		pauseEventPlayer()
		if (eventPlayerPaused)
			pauseButton.html('Play')
		else
			pauseButton.html('Pause')
	})

	progressBar.click(function(e) {
		setTimeEventPlayer((e.pageX - progressBar.offset().left) / progressBar.width())
	})
	}
});