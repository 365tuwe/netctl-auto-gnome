/*
 * Netctl Menu is a Gnome 3 extension that allows you to  switch between netctl
 * profiles using a menu in the notification area.
 *
 * Copyright (C) 2016 Nigel S. Michki 
 * Previous contributors :
 * - Tjaart van der Walt (original creator)
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */

//Imports/definitions
const Clutter = imports.gi.Clutter;
const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;
const Lang = imports.lang;
const St = imports.gi.St;
const Shell = imports.gi.Shell;

const Gettext = imports.gettext.domain('gnome-shell-extensions');
const _ = Gettext.gettext;

const Main = imports.ui.main;
const Panel = imports.ui.panel;
const PanelMenu = imports.ui.panelMenu;
const PopupMenu = imports.ui.popupMenu;

//Items of interest
const netctl_bin = '/usr/bin/netctl';
var lastactive = "";


//Names of icons for the activities bar
const NETWORK_CONNECTED = 'network-wireless-signal-excellent-symbolic';
//const NETWORK_CONNECTED = 'network-wireless';
const NETWORK_OFFLINE = 'network-wireless-offline-symbolic';
//const NETWORK_OFFLINE = 'network-offline';

const REFRESH_TIME = 3 //seconds

//The extension core
const NetctlSwitcher = new Lang.Class({
    Name: 'NetctlSwitcher',
    Extends: PanelMenu.Button,

    _init: function() {
        this.parent(0.0, 'NetctlSwitcher');

        this.icon = new St.Icon({
            icon_name: 'network-wireless-acquiring-symbolic',
            style_class: 'system-status-icon'
        });
        let box = new St.BoxLayout({
            vertical: false,
            style_class: 'panel-status-menu-box'
        });
        this.label = new St.Label({
            text: '',
            y_expand: true,
            y_align: Clutter.ActorAlign.CENTER
        });
        box.add_child(this.icon);
        box.add_child(this.label);
        this.actor.add_actor(box);

        //Initial population of the menu
        this._set_icon();
        this._update_menu();

        //Refresh the menu every REFRESH_TIME seconds
        this._refresh_details();
    },

    _netctlOff: function() {
    	// Profiles off
        let profiles = this._get_network_profiles();
        this._execute("stop-all")
        for (let i = 0; i < profiles.length; i++) {
        	this._execute("disable", profiles[i])
        }
    },

    _netctlOn: function() {
    	// Profiles on
        let profiles = this._get_network_profiles();
        for (let i = 0; i < profiles.length; i++) {
        	this._execute("enable", profiles[i])
        }

        // Start last active profile
        if (lastactive.length > 0) {
        	this._execute("start", lastactive)
        }
    },

    _get_network_profiles: function() {
        var profileString = this._execute("list")[1].toString();
        var profileArray = profileString.split("\n")
        return profileArray.splice(0, profileArray.length - 1)
    },

    _get_connected_networks: function() {
    	// Get connected networks.  This also sets the last active connection
        let networks = this._execute("list")[1].toString();
        let connected = networks.match(/\*.*/g);
        lastactive = connected;
        return connected;
    },

    _switch_to_profile: function(profileName) {
        this._execute_async(netctl_bin + " switch-to " + profileName);
    },

    _execute: function(command, profile = "") {
    	   let cmdlist = [
    		'list',
    		'store',
			'restore',
			'stop-all',
			'start',
			'stop',
			'restart',
			'switch-to',
			'is-active',
			'status',
			'enable',
			'disable',
			'reenable',
			'is-enabled',
			'edit'];
    	if (command == "list") {
    		return GLib.spawn_command_line_sync(netctl_bin + " list");
    	} else if ((cmd in cmdlist) && (profile in this._get_network_profiles)) {
	    	return GLib.spawn_command_line_sync(netctl_bin + " " + cmd);
   		} else {
			return "";
		}
    },

    _execute_async: function(command) {
        try {
            let [result, argv] = GLib.shell_parse_argv(command);
            GLib.spawn_async(null, argv, null, GLib.SpawnFlags.SEARCH_PATH, null);
        } catch (e) {
            global.logError(e);
        }
    },

    _update_menu: function() {
        this.menu.removeAll();

        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem(_('Profiles')));
        var profiles = this._get_network_profiles();
        for (let i = 0; i < profiles.length; i++) {
            this._add_profile_menu_item(profiles[i]);
        }

        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem(_('Options')));
        this.netctlOffMenuItem = new PopupMenu.PopupMenuItem(_('Wireless Off'));
        this.netctlOnMenuItem = new PopupMenu.PopupMenuItem(_('Wireless On'));
        this.netctlOffMenuItem.connect('activate', Lang.bind(this, this._netctlOff));
        this.netctlOnMenuItem.connect('activate', Lang.bind(this, this._netctlOn));
        this.menu.addMenuItem(this.netctlOnMenuItem);
        this.menu.addMenuItem(this.netctlOffMenuItem);
    },

    _add_profile_menu_item: function(profile) {
        if (!profile.match(/\*.*/g)) {
            let menuItem = new PopupMenu.PopupMenuItem(profile);
            this.menu.addMenuItem(menuItem);
            menuItem.connect('activate', Lang.bind(this, function() {
                this._switch_to_profile(profile);
            }));
        } else {
            this.menu.addMenuItem(new PopupMenu.PopupMenuItem(_(profile)));
        }
    },

    _set_icon: function() {
        if (this._get_connected_networks() == null) {
            this.icon.icon_name = NETWORK_OFFLINE;
        } else {
            this.icon.icon_name = NETWORK_CONNECTED;
        }
    },

    _refresh_details: function() {
        event = GLib.timeout_add_seconds(0, REFRESH_TIME, Lang.bind(this, function() {
            this._set_icon();
            this._update_menu();
            return true;
        }));
    }

});

let netctlSwitcher;

function init() {}

function enable() {
    netctlSwitcher = new NetctlSwitcher();
    Main.panel.addToStatusArea('NetctlSwitcher', netctlSwitcher);
}

function disable() {
    netctlSwitcher.destroy();
}