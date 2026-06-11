+++
title = "Python Libraries — Django, Twisted, Tornado, Flask, Cyclone and Pyramid"
date = 2013-05-19
description = "A 2013 field guide to picking a Python web framework — recovered from the original dhilipsiva.com via the Wayback Machine."

[taxonomies]
tags = ["python"]

[extra]
type = "notes"
original_url = "https://web.archive.org/web/20140506072634/http://dhilipsiva.com/2013/05/19/python-libraries-django-twisted-tornado-flask-cyclone-and-pyramid.html"
original_platform = "the original dhilipsiva.com (via Wayback Machine)"
+++

*"[**Django**](https://www.djangoproject.com/) is a high-level Python Web framework that encourages rapid development and clean, pragmatic design"*. If you are building something that is similar to a e-commerce site, then you should probably go with `Django`. It will get your work done quick. You don't have to worry about too many technology choices. It provides everything thing you need from template engine to `ORM`. It will be slightly opinionated about the way you structure your app, which is good If you ask me. And it has the strongest community of all the other libraries, which means easy help is available.

*"[**Flask**](http://flask.pocoo.org/) is a microframework for Python based on Werkzeug, Jinja 2 and good intentions"*. Beware - "microframework" may be misleading. This does not mean that `Flask` is a half-baked library. This mean the core of `Flask` is very, very simple. Unlike `Django`, It will not make any Technology decisions for you. You are free to choose any template engine or `ORM` that pleases you. Even though it comes with `Jinja` template engine by default, you are always free to choose our own. As far as I know `Flask` comes in handy for writing APIs endpoints (`RESTful rervices`).

*"[**Twisted**](https://twistedmatrix.com/trac/) is an event-driven networking engine written in python"*. This is a high-performance engine. The main reason for its speed is something called as deferred. `Twisted` is built on top of `deferred`. For those of you who don't know about deferred, it is the mechanism through with asynchronous architecture is achieved. `Twisted` is very fast. But is not suitable for writing conventional WebApps. If you want to do something low-level networking stuff, `Twisted` is your friend.

*"[**Tornado**](http://www.tornadoweb.org/en/stable/) is a Python web framework and asynchronous networking library, originally developed at `FriendFeed`. By using non-blocking network I/O, `Tornado` can scale to tens of thousands of open connections, making it ideal for long polling, `WebSockets`, and other applications that require a long-lived connection to each user"*. `Tornado` stands some where between `Django` and `Flask`. If you want to write something with `Django` or `Flask`, but if you need a better performance, you can opt for `Tornado`. It can handle C10k problem very well if it is architected right.

*"[**Cyclone**](http://cyclone.io/) is a web server framework for Python that implements the `Tornado` API as a Twisted protocol"*. Now, what if you want something with `Twisted`'s performance and easy to write conventional webapps? Say hello to `Cyclone`. I would prefer `Cyclone` over `Tornado`. It has an API that is very similar to `Tornado`. As a matter of fact, this is a fork of `Tornado`. But the problem is it has relatively small community. Alexandre Fiori is the only main commiter to the repo.

*"[**Pyramid**](http://docs.pylonsproject.org/en/latest/docs/pyramid.html) is a general, open source, Python web application development framework. Its primary goal is to make it easier for a Python developer to create web applications"*. I haven't really used `Pyramid`, but I went through the documentation. From what I understand, `Pyramid` is very similar to `Flask` and I think you can use `Pyramid` wherever `Flask` seems appropriate and vice-versa.

Want me to review any other library? Please leave a comment below.

Comments / Suggestions / Edits welcomed.

I answered a question on StackOverflow [here](http://stackoverflow.com/questions/13941903/when-to-use-tornado-when-to-use-twisted-cyclone-gevent-other/16630916#16630916)
