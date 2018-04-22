OpenSlides Conversations Plugin

Overview
========

This BETA plugin for OpenSlides provides online conferences in the webbrowser
using WebRTC


Requirements
============

OpenSlides 2.1.x (https://openslides.org/)


Install
=======

This is only an example instruction to install the plugin on GNU/Linux. It
can also be installed as any other Python package and on other platforms,
e. g. on Windows.

Change to a new directory::

    $ cd

    $ mkdir OpenSlides

    $ cd OpenSlides

Setup and activate a virtual environment and install OpenSlides and the
plugin in it::

    $ python3 -m venv .virtualenv

    $ source .virtualenv/bin/activate

    $ pip install -e /path/to/openslides-conversations

Start OpenSlides::

    $ python3 manage.py start


Using the plugin
================

After the plugin is installed, the "conversations" icon will appear in the navigation bar.
Clicking it will navigate the user to the "Moderated Discussion" page.
In here, a moderator is able to stream their audio and/or video using their webcam and their microphone
to other users also viewing the "Moderated Discussion" page.
Moderators might also request a user to take over the discussion.

Administrators might enable or disable video streaming in the OpenSlides settings menu.

In the header of the "Moderated Discussion" page, the user can navigate to a "Group Conversation" page
or a "Private Conversation" page.

In the "Group Conversation" page a user can participate to a Group chat and VoIP session by clicking
on a channel on the left side of the page

In the "Private Conversation" page a user can have a private chat or VoIP Session (with webcam)
by clicking on a user on the left side.
Only users who are currently visiting the "Private Conversation" page are shown.


License and authors
===================

This plugin is Free/Libre Open Source Software and distributed under the
MIT License, see LICENSE file. The authors are mentioned in the AUTHORS file.


Changelog
=========

Version 0.1 (BETA)

* First release of this plugin for OpenSlides 2.1