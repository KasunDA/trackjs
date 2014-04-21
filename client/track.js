jQuery(function($) {

	jQuery.uaMatch = function(ua) {
		ua = ua.toLowerCase();

		var match = /(chrome)[ \/]([\w.]+)/.exec(ua) ||
			/(webkit)[ \/]([\w.]+)/.exec(ua) ||
			/(opera)(?:.*version|)[ \/]([\w.]+)/.exec(ua) ||
			/(msie) ([\w.]+)/.exec(ua) ||
			ua.indexOf("compatible") < 0 && /(mozilla)(?:.*? rv:([\w.]+)|)/.exec(ua) ||
			[];

		return {
			browser: match[1] || "",
			version: match[2] || "0"
		};
	};

	matched = jQuery.uaMatch(navigator.userAgent);
	browser = {};

	if (matched.browser) {
		browser.name = matched.browser
		browser.version = matched.version;
	}
	else {
		browser.name = 'Unknown browser'
		browser.version = '?'
	}

	if (browser.chrome) {
		browser.webkit = true;
	} else if (browser.webkit) {
		browser.safari = true;
	}

	jQuery.browser = browser;

	function createCookie(name, value, days) {
	    if (days) {
	        var date = new Date();
	        date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
	        var expires = "; expires=" + date.toGMTString();
	    } else var expires = "";
	    document.cookie = escape(name) + "=" + escape(value) + expires + "; path=/";
	}
	
	function readCookie(name) {
	    var nameEQ = escape(name) + "=";
	    var ca = document.cookie.split(';');
	    for (var i = 0; i < ca.length; i++) {
	        var c = ca[i];
	        while (c.charAt(0) == ' ') c = c.substring(1, c.length);
	        if (c.indexOf(nameEQ) == 0) return unescape(c.substring(nameEQ.length, c.length));
	    }
	    return (undefined);
	}
	
	function eraseCookie(name) {
	    createCookie(name, "", -1);
	}

	var socket = io.connect('http://127.0.0.1:7455');
	var mousePos = { x: -1, y: -1 };
	var lastSentMousePos = { x: -1, y: -1 };
	var lastSentViewportOffset = { x: 0, y: 0 };
	var pixelRatio = window.devicePixelRatio == undefined ? 1 : window.devicePixelRatio
	var userScreen = { sizeX : screen.width * pixelRatio, sizeY : screen.height * pixelRatio };
	var viewport = { sizeX : $(window).width() * pixelRatio, sizeY : $(window).height() * pixelRatio }
	var sent
	var date = new Date();
	var focused = false
	var tag
	var windowPos = undefined
	var topMargin = undefined
	var lastSentWindowPos = undefined

	socket.socket.on('error', function (reason) {
		console.error('Unable to connect Socket.IO server');
	});

	socket.on('connect', function () {

		function getTime() {
			return (new Date().getTime())
		}
	
		function sendHtmlPart(i) {
			var html = undefined
			var interval = 50000
	
			html = document.documentElement.innerHTML.slice(0 + (i * interval), interval + (i * interval))
			socket.emit('pageHtml', { html: html, date: getTime() })
			if (html != '')
			{
				setTimeout(function() { 
					sendHtmlPart(i + 1)
				}, 20)
			}
		}
	
		function sendInitialData(sendHtml) {
			getWindowPos()
			lastSentWindowPos = windowPos
			socket.emit('initialdata', { url: document.URL, screenWidth: userScreen.sizeX, screenHeight: userScreen.sizeY,
											viewportWidth: viewport.sizeX, viewportHeight: viewport.sizeY,
											browserPosX: windowPos.posX, browserPosY: windowPos.posY, browserHeight: windowPos.browserHeight,
											browserName: browser.name, browserVersion: browser.version,
											initialScrollX: window.pageXOffset, initialScrollY: window.pageYOffset,
											lang: navigator.language || navigator.userLanguage, date: getTime(), tag: tag })
			if (sendHtml == true)
				socket.emit('pageHtml', { html: document.documentElement.innerHTML, date: getTime() })
			$('select, input, textarea').each(function () {
				if ($(this).val() != '')
				{
					onChange($(this), true)
				}
			});
		}
	
		function getWindowPos() {
			var tM = topMargin == undefined ? 0 : topMargin
			var bH = $(window).height()
	
			if (window.outerHeight != undefined)
				bh = window.outerHeight
			windowPos = { posX : window.screenX == undefined ? window.screenLeft : window.screenX, posY: window.screenY == undefined ? window.screenTop : window.screenY, topMargin: tM, browserHeight: bh}
		}
	
		//also try to get position of content in browser window
		function checkWindowPos(force) {
			getWindowPos()
	
				if (windowPos.posX != lastSentWindowPos.posX 
					|| windowPos.posY != lastSentWindowPos.posY
					|| windowPos.browserHeight != lastSentWindowPos.browserHeight
					|| windowPos.topMargin != lastSentWindowPos.topMargin
					|| force)
				{
					socket.emit('windowmove', { x: windowPos.posX, y: windowPos.posY, topMargin: windowPos.topMargin, browserHeight: windowPos.browserHeight, date: getTime() })
				}
			lastSentWindowPos = windowPos
		}
	
		function init() {
			if (readCookie('tag') == undefined)
				createCookie('tag', '!' + Math.random())
			tag = readCookie('tag')
			getWindowPos()
			sendInitialData(true)
		}
	
		setTimeout(function(){init()}, 100);
		setInterval(function(){checkWindowPos(false)}, 300);
	
		// monitor scroll
		$(window).bind('scroll', function () {
			if (Math.abs(lastSentViewportOffset.x - window.pageXOffset) >= 3 || Math.abs(lastSentViewportOffset.y - window.pageYOffset))
			{
				lastSentViewportOffset.x = window.pageXOffset
				lastSentViewportOffset.y = window.pageYOffset
				socket.emit('scrolltick', { x: window.pageXOffset, y: window.pageYOffset, date: getTime() })
			}
		});
	
		// monitor window size
		$(window).resize(function () {
			viewport = { sizeX : $(window).width(), sizeY : $(window).height(), date: getTime() }
			socket.emit('resize', { viewportWidth: viewport.sizeX * pixelRatio, viewportHeight: viewport.sizeY * pixelRatio, date: getTime() })
		});
	
		// monitor keyboard input
		$(window).keyup(function(event) {
			if (String.fromCharCode(event.which) != '' && focused == false)
			{
				socket.emit('keypress', { keyCode: String.fromCharCode(event.which), date: getTime() })
			}
		});
	
		// monitor mouse movement
		function onMouseMove(event, forceRefresh) {
			mousePos.x = event.pageX
			mousePos.y = event.pageY
	
			if (windowPos != undefined)
				if (event.screenY - event.clientY - windowPos.posY != topMargin)
				{
					topMargin = event.screenY - event.clientY - windowPos.posY
					checkWindowPos(true)
				}
	
			if (forceRefresh || (Math.abs(lastSentMousePos.x - mousePos.x) >= 3 || Math.abs(lastSentMousePos.y - mousePos.y) >= 3))
			{
				socket.emit('mousetick', { x: mousePos.x, y: mousePos.y, date: getTime() })
				lastSentMousePos.x = mousePos.x
				lastSentMousePos.y = mousePos.y
			}
		}
		$(document).mousemove(function (e) {
			onMouseMove(e, false);
		});
		$(document).on({ 'touchstart touchend' : function(e){
			var touch = e.originalEvent.touches[0] || e.originalEvent.changedTouches[0];
			onMouseMove(touch, true)
		}});
		$(document).on({ 'touchmove' : function(e){ //to change
			var touch = e.originalEvent.touches[0] || e.originalEvent.changedTouches[0];
			if (Math.abs(touch.pageX - lastSentMousePos.x) > 10 && Math.abs(touch.pageY - lastSentMousePos.y) < 25) {
				event.preventDefault();
				onMouseMove(touch, true)
			}
			else
				onMouseMove(touch, false)
		} });
	
		// monitor mouse clicks
		$(document).click(function(event) {
			socket.emit('mouseclic', { x: event.pageX, y: event.pageY, date: getTime() })
		});
	
		// monitor form focus
		$('select, input, textarea').focus(function(event) {
			var eId = $(this).attr('id') != undefined ? $(this).attr('id') : ''
			var eName = $(this).attr('name') != undefined ? $(this).attr('name') : ''
			// ^ factoriser
			socket.emit('focus', { element_id: eId, element_name: eName, date: getTime() })
			focused = true
		});
		$('select, input, textarea').blur(function(event) {
			var eId = $(this).attr('id') != undefined ? $(this).attr('id') : ''
			var eName = $(this).attr('name') != undefined ? $(this).attr('name') : ''
			socket.emit('blur', { element_id: eId, element_name: eName, date: getTime() })
			focused = false
		});
	
		// monitor form change
		function onChange(e, isInitial) {
			var eventName = isInitial ? 'formset' : 'formchange'
			var eId = e.attr('id') != undefined ? e.attr('id') : ''
			var eName = e.attr('name') != undefined ? e.attr('name') : ''
	
			socket.emit(eventName, { element_id: eId, element_name: eName, val: e.val(), date: getTime() })
		}
		$('select, input, textarea').on('input', function() {
			onChange($(this), false)
		});
		$('select, input, textarea').on('change', function() {
			onChange($(this), false)
		});

	});
});
