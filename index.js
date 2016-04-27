var inherits = require('util').inherits;
var osascript = require('node-osascript');
var applescript = require('applescript');
var Accessory, Service, Characteristic, UUIDGen;
var HomeKitMediaTypes;
var HKMTGen = require('./HomeKitMediaTypes.js');

module.exports = function(homebridge) {
  Accessory = homebridge.platformAccessory;
  Service = homebridge.hap.Service;
  Characteristic = homebridge.hap.Characteristic;
  UUIDGen = homebridge.hap.uuid;
  HomeKitMediaTypes = HKMTGen(homebridge);

  homebridge.registerPlatform("homebridge-itunes", "iTunes", ITunesPlatform, true);

  Characteristic.prototype.updateValue = function(newValue, context){
    if (newValue === undefined || newValue === null)
      newValue = this.getDefaultValue();

    // update our cached value
    var oldValue = this.value;
    this.value = newValue;

    // emit a change event if necessary
    if (oldValue !== newValue)
      this.emit('change', { oldValue:oldValue, newValue:newValue, context:context });
  }
}

function ITunesPlatform(log, config, api) {
  var self = this;

  self.log = log;
  self.config = config || { "platform": "iTunes" };
  self.accessories = {};
  self.syncTimer = null;
  self.pollInterval = 2000;

  if (api) {
    self.api = api;

    self.api.on('didFinishLaunching', self.didFinishLaunching.bind(this));
  }
}

ITunesPlatform.prototype.configureAccessory = function(accessory) {
  if(accessory.context.iTunesMac){
    this.configurePrimaryAccessory(accessory);
  } else {
    this.configureAirPlayAccessory(accessory);
  }
}

ITunesPlatform.prototype.configurePrimaryAccessory = function(accessory) {
  var self = this;

  accessory.reachable = true;

  this.primaryAccessory = accessory;

  var cxPlayStateOn = accessory
  .getService('Playing State')
  .getCharacteristic(Characteristic.On);
  var cxPlayState = accessory
  .getService(HomeKitMediaTypes.PlaybackDeviceService)
  .getCharacteristic(HomeKitMediaTypes.PlaybackState);

  accessory.getPlaybackStateFromString = function(str){
    switch (str) {
      case "paused":
        return HomeKitMediaTypes.PlaybackState.PAUSED;
        break;
      case "stopped":
        return HomeKitMediaTypes.PlaybackState.STOPPED;
        break;
      default:
        return HomeKitMediaTypes.PlaybackState.PLAYING;
        break;
    }
  }

  cxPlayState
  .on('get', function(callback){
    var tell = 'tell application "iTunes" to get player state';
    osascript.execute(tell, function(err, rtn) {
      if(err){
        callback(err)
      } else {
        rtn = applescript.Parsers.parse(rtn);
        callback(false, accessory.getPlaybackStateFromString(rtn));
      }
    }.bind(this));
  }.bind(this))
  .on('set', function(newVal, callback){
    switch (newVal) {
      case HomeKitMediaTypes.PlaybackState.PLAYING:
        var tell =
          'tell application "iTunes"\n'
          + 'if player state is paused or (exists current track) then play\n'
          + 'if player state is stopped then\n'
            + 'if exists user playlist "AutoPlay" then\n'
		          + 'play user playlist "AutoPlay"\n'
            + 'else\n'
	            + 'play (some playlist whose special kind is Music)\n'
            + 'end if\n'
          + 'end if\n'
        + 'end tell'
        osascript.execute(tell, function(err, rtn) {
          if(err){
            callback(err)
          } else {
            callback();
          }
        }.bind(this));
        break;
      case HomeKitMediaTypes.PlaybackState.PAUSED:
        osascript.execute('tell application "iTunes" to pause', function(err, rtn){
          if(err){
            callback(err)
          } else {
            callback();
          }
        }.bind(this));
        break;
      case HomeKitMediaTypes.PlaybackState.STOPPED:
        osascript.execute('tell application "iTunes" to stop', function(err, rtn){
          if(err){
            callback(err)
          } else {
            callback();
          }
        }.bind(this));
        break;
      default:
        callback("Invalid value for PlaybackState!");
        break;
    }
    cxPlayStateOn.getValue(); // Sync up slave cx with this master cx
  }.bind(this))
  .on('change', function(newVal){
    cxPlayStateOn.getValue(); // Sync up slave cx with this master cx
  }.bind(this))

  accessory
  .getService(HomeKitMediaTypes.PlaybackDeviceService)
  .getCharacteristic(HomeKitMediaTypes.SkipForward)
  .on('set', function(newVal, callback){
    osascript.execute('tell application "iTunes" to next track', function(err, rtn) {
      if(err){
        callback(err)
      } else {
        callback();
      }
    }.bind(this));
  }.bind(this));

  accessory
  .getService(HomeKitMediaTypes.PlaybackDeviceService)
  .getCharacteristic(HomeKitMediaTypes.SkipBackward)
  .on('set', function(newVal, callback){
    osascript.execute('tell application "iTunes" to back track', function(err, rtn) {
      if(err){
        callback(err)
      } else {
        callback();
      }
    }.bind(this));
  }.bind(this));

  accessory
  .getService(HomeKitMediaTypes.AudioDeviceService)
  .getCharacteristic(HomeKitMediaTypes.AudioVolume)
  .on('get', function(callback){
    var tell = 'tell application "iTunes" to get sound volume';
    osascript.execute(tell, function(err, rtn) {
      if (err) {
        callback(err);
      } else {
        callback(false, parseInt(rtn));
      }
    });
  })
  .on('set', function(newVal, callback){
    var tell = 'tell application "iTunes" to set sound volume to ' + parseInt(newVal);
    osascript.execute(tell, function(err, rtn) {
      if (err) {
        callback(err);
      } else {
        callback(false);
      }
    });
  });

  // Hack switch characteristics to emulate media controls...

  cxPlayStateOn
  .on('get', function(callback){
    cxPlayState
    .getValue(function(err, val){
      if(err)
        callback(err);
      else
        callback(false, val == HomeKitMediaTypes.PlaybackState.PLAYING);
    }.bind(this));
  }.bind(this))
  .on('set', function(newVal, callback){
    if(newVal == true && cxPlayState.value !== HomeKitMediaTypes.PlaybackState.PLAYING)
      cxPlayState.setValue(HomeKitMediaTypes.PlaybackState.PLAYING, callback);
    if(newVal == false && cxPlayState.value == HomeKitMediaTypes.PlaybackState.PLAYING)
      cxPlayState.setValue(HomeKitMediaTypes.PlaybackState.PAUSED, callback);
  }.bind(this))
  .getValue(function(err, value){
    if(err)
      self.log(err);
  });

  accessory
  .getService('Track Skipper')
  .getCharacteristic(Characteristic.On)
  .on('get', function(callback){ callback('false'); })
  .on('set', function(newVal, callback){
    if(!newVal){ callback(); return; }
    accessory
    .getService(HomeKitMediaTypes.PlaybackDeviceService)
    .getCharacteristic(HomeKitMediaTypes.SkipForward)
    .setValue(true, function(err){
      if(err)
        callback(err);
      else
        callback();
      setTimeout(function(){
        accessory
        .getService('Track Skipper')
        .getCharacteristic(Characteristic.On)
        .setValue(false);
      }, 100);
    });
  }.bind(this));

  accessory
  .getService('Album Skipper')
  .getCharacteristic(Characteristic.On)
  .on('get', function(callback){ callback('false'); })
  .on('set', function(newVal, callback){
    if(!newVal){ callback(); return; }

    var tell = 'tell application "iTunes"\n'
      + 'set |current album| to the album of the current track\n'
  	    + 'repeat while the album of the current track is equal to |current album|\n'
		    + 'next track\n'
      + 'end repeat\n'
    + 'end tell';

    osascript.execute(tell, function(err, rtn) {
      if(err)
        callback(err);
      else
        callback();
      setTimeout(function(){
        accessory
        .getService('Album Skipper')
        .getCharacteristic(Characteristic.On)
        .setValue(false);
      }, 100);
    }.bind(this));
  }.bind(this));

}

ITunesPlatform.prototype.configureAirPlayAccessory = function(accessory) {
  var self = this;

  accessory.reachable = true;

  var rawDevice = accessory.context.rawDevice;

  this.accessories[rawDevice.mac] = accessory;

  accessory
  .getService(Service.Switch)
  .getCharacteristic(Characteristic.On)
  .on('get', function(callback){
    var tell = 'tell application "iTunes" to get selected of (AirPlay device id ' + parseInt(accessory.context.rawDevice.id) + ')';
    osascript.execute(tell, function(err, rtn) {
      if (err) {
        callback(err);
      } else {
        //rtn = applescript.Parsers.parse(rtn);
        callback(false, !!rtn ? true : false);
      }
    });
  })
  .on('set', function(newVal, callback){
    // Now what we gonna do is...
    var tell = 'tell application "iTunes" to set selected of (AirPlay device id ' + parseInt(accessory.context.rawDevice.id) + ') to ' + (newVal ? 'true' : 'false');
    // First, we need to handle auto play/pause actions before changing state...
    var cxPlaybackState = this.primaryAccessory
    .getService(HomeKitMediaTypes.PlaybackDeviceService)
    .getCharacteristic(HomeKitMediaTypes.PlaybackState);
    if(newVal == true) {
      // Go ahead and turn this one on now...
      osascript.execute(tell, function(err, rtn) { if (err) callback(err); else callback(false); });
      // If one AirPlay device turned on and not currently playing...
      if(cxPlaybackState.value !== HomeKitMediaTypes.PlaybackState.PLAYING){
        // Turn other AirPlay destinations off...
        //TODO: Make this behavior configurable!
        for(var k in this.accessories){
          var apac = this.accessories[k];
          if(!apac || apac === accessory || !apac.getService) continue;
          apac
          .getService(Service.Switch)
          .getCharacteristic(Characteristic.On)
          .setValue(false);
        }
        cxPlaybackState.setValue(HomeKitMediaTypes.PlaybackState.PLAYING)
      }
    } else {
      // If are turning off the last AirPlay device, pause playback...
      var anyOn = false;
      for(var k in this.accessories){
        var apac = this.accessories[k];
        if(!apac || apac === accessory || !apac.getService) continue;
        var isOn = apac
        .getService(Service.Switch)
        .getCharacteristic(Characteristic.On)
        .value;
        if(isOn){ anyOn = true; break; }
      }
      if(!anyOn) cxPlaybackState.setValue(HomeKitMediaTypes.PlaybackState.PAUSED);
      // Now turn this one off...
      osascript.execute(tell, function(err, rtn) { if (err) callback(err); else callback(false); });
    }
  }.bind(this))
  .getValue(function(err, value){
    if(err)
      self.log(err);
    else {
      accessory.getService(Service.Switch).getCharacteristic(Characteristic.On).value = value;
    }
  });

  accessory
  .getService(HomeKitMediaTypes.AudioDeviceService)
  .getCharacteristic(HomeKitMediaTypes.AudioVolume)
  .on('get', function(callback){
    var tell = 'tell application "iTunes" to get sound volume of (AirPlay device id ' + parseInt(accessory.context.rawDevice.id) + ')';
    osascript.execute(tell, function(err, rtn) {
      if (err) {
        callback(err);
      } else {
        callback(false, parseInt(rtn));
      }
    });
  })
  .on('set', function(newVal, callback){
    var tell = 'tell application "iTunes" to set sound volume of (AirPlay device id ' + parseInt(accessory.context.rawDevice.id) + ') to ' + parseInt(newVal);
    osascript.execute(tell, function(err, rtn) {
      if (err) {
        callback(err);
      } else {
        callback(false);
      }
    });
  })
  .getValue(function(err, value){
    if(err)
      self.log(err);
    else {
      accessory.getService(HomeKitMediaTypes.AudioDeviceService).getCharacteristic(HomeKitMediaTypes.AudioVolume).value = value;
    }
  });
}



ITunesPlatform.prototype.didFinishLaunching = function() {
  this.syncAccessories();
}

ITunesPlatform.prototype.syncAccessoriesScheduler = function(msec){
  clearTimeout(this.syncTimer);
  this.syncTimer = setTimeout(this.syncAccessories.bind(this), msec);
};

ITunesPlatform.prototype.syncAccessories = function() {
  var syncAgainIn = this.syncAccessoriesScheduler.bind(this);
  syncAgainIn(this.pollInterval);

  // Update the primary accessory
  var pa = this.primaryAccessory;
  if(!pa){
    osascript.execute('get the primary Ethernet address of (get system info)', function(err, rtn){
      if(err) {
        // erm...well this is awkward...Try again in a bit?
        this.log(err);
        this.log("ERROR: Failed creating iTunes main device, trying again in two seconds.");
        syncAgainIn(2000);
      } else {
        // Messes up MAC addresses that start with a number >:-(
        // The node-osascript parser is sufficient for this simple string.
        //rtn = applescript.Parsers.parse(rtn);
        this.addPrimaryAccessory(rtn);
      }
    }.bind(this));
    return; // BRB...
  } else {
    osascript.execute('tell application "iTunes" to get {player state, sound volume, exists current track}', function(err, rtn){
      if (err) {
        this.log(err);
        this.log("ERROR: Failed syncing iTunes main device, trying again in two seconds.");
        syncAgainIn(2000);
        return;
      }
      rtn = applescript.Parsers.parse(rtn);
      if (Array.isArray(rtn)) {
        pa
        .getService(HomeKitMediaTypes.PlaybackDeviceService)
        .getCharacteristic(HomeKitMediaTypes.PlaybackState)
        .updateValue(pa.getPlaybackStateFromString(rtn[0]));
        pa
        .getService(HomeKitMediaTypes.AudioDeviceService)
        .getCharacteristic(HomeKitMediaTypes.AudioVolume)
        .updateValue(parseInt(rtn[1]));

        if(rtn[2]){
          this.syncMediaInformation();
        }
      }
    }.bind(this));
  }

  // Get the id and name of all the AirPlay devices...
  var tell = 'tell application "iTunes"\n'
      + 'set apDevMap to {}\n'
      + 'repeat with aDevice in (AirPlay devices)\n'
        //+ "copy {id:aDevice's id, name:aDevice's name, mac:aDevice's network address} to the end of the apDevMap\n"
        + "copy {aDevice's id, aDevice's name, aDevice's network address, aDevice's selected, aDevice's sound volume} to the end of the apDevMap\n"
      + 'end repeat\n'
      + 'get apDevMap\n'
  + 'end tell\n';

  osascript.execute(tell, function(err, rtn) {
    if (err) {
      this.log(err);
      this.log("ERROR: Failed getting AirPlay devices--iTunes may still be launching. Trying again in two seconds.");
      syncAgainIn(2000);
      return;
    }
    rtn = applescript.Parsers.parse(rtn);
    if (Array.isArray(rtn)) {
      for(var i = 0; i < rtn.length; i++)
        rtn[i] = {
          id: rtn[i][0],
          name: rtn[i][1],
          mac: (rtn[i][2] == "missing value" ? null : rtn[i][2]),
          selected: rtn[i][3] == "true" ? true : false,
          volume: parseInt(rtn[i][4])
        };
      this.rawDevices = rtn;

      // Update id's and values and add any devices we didn't have before...
      var foundMacs = {};
      for (var i = 0; i < this.rawDevices.length; i++) {
        var rawDevice = this.rawDevices[i];
        if(!rawDevice.mac) rawDevice.mac = '00-host-audio';
        foundMacs[rawDevice.mac] = true;

        if (this.accessories[rawDevice.mac]) {
          var accessory = this.accessories[rawDevice.mac];

          accessory.context.rawDevice = rawDevice;

          var volCx = accessory.getService(HomeKitMediaTypes.AudioDeviceService).getCharacteristic(HomeKitMediaTypes.AudioVolume);
          if(volCx.value != rawDevice.volume)
            volCx.updateValue(rawDevice.volume);

          var onCx = accessory.getService(Service.Switch).getCharacteristic(Characteristic.On);
          if(onCx.value != rawDevice.selected)
            onCx.updateValue(rawDevice.selected);

          if(!accessory.reachable) accessory.updateReachability(true);
        } else {
          this.addAirPlayAccessory(rawDevice);
        }
      }
      // Set any devices now missing to unreachable...
      for(var m in this.accessories){
        if(this.accessories[m] instanceof Accessory && !foundMacs[m])
          this.accessories[m].updateReachability(false);
      }

    }
  }.bind(this));

}

ITunesPlatform.prototype.syncMediaInformation = function(){
  var tell = 'tell application "iTunes"\n'
	+'set theResult to {exists current track}\n'
	+'if exists current track then\n'
	+'	set end of theResult to name of current track\n'
	+'	set end of theResult to album of current track\n'
	+'	set end of theResult to artist of current track\n'
	+'	set end of theResult to duration of current track\n'
	+'	set end of theResult to player position\n'
	+'end if\n'
	+'get theResult\n'
  +'end tell';

  osascript.execute(tell, function(err, rtn){
    if (err) {
      this.log(err);
      this.log("ERROR: Failed syncing media information, trying again in two seconds.");
      this.syncAccessoriesScheduler(2000);
      return;
    }
    var pa = this.primaryAccessory;
    //rtn = applescript.Parsers.parse(rtn);
    if (Array.isArray(rtn) && rtn[0]) {
      pa
      .getService(HomeKitMediaTypes.PlaybackDeviceService)
      .getCharacteristic(HomeKitMediaTypes.MediaItemName)
      .updateValue(rtn[1]);
      pa
      .getService(HomeKitMediaTypes.PlaybackDeviceService)
      .getCharacteristic(HomeKitMediaTypes.MediaItemAlbumName)
      .updateValue(rtn[2]);
      pa
      .getService(HomeKitMediaTypes.PlaybackDeviceService)
      .getCharacteristic(HomeKitMediaTypes.MediaItemArtist)
      .updateValue(rtn[3]);
      pa
      .getService(HomeKitMediaTypes.PlaybackDeviceService)
      .getCharacteristic(HomeKitMediaTypes.MediaItemDuration)
      .updateValue(rtn[4]);
      pa
      .getService(HomeKitMediaTypes.PlaybackDeviceService)
      .getCharacteristic(HomeKitMediaTypes.MediaCurrentPosition)
      .updateValue(rtn[5]);
    } else {
      pa
      .getService(HomeKitMediaTypes.PlaybackDeviceService)
      .getCharacteristic(HomeKitMediaTypes.MediaItemName)
      .updateValue("");
      pa
      .getService(HomeKitMediaTypes.PlaybackDeviceService)
      .getCharacteristic(HomeKitMediaTypes.MediaItemAlbumName)
      .updateValue("");
      pa
      .getService(HomeKitMediaTypes.PlaybackDeviceService)
      .getCharacteristic(HomeKitMediaTypes.MediaItemArtist)
      .updateValue("");
      pa
      .getService(HomeKitMediaTypes.PlaybackDeviceService)
      .getCharacteristic(HomeKitMediaTypes.MediaItemDuration)
      .updateValue(0);
      pa
      .getService(HomeKitMediaTypes.PlaybackDeviceService)
      .getCharacteristic(HomeKitMediaTypes.MediaCurrentPosition)
      .updateValue(0);
    }
  }.bind(this));
}

ITunesPlatform.prototype.addPrimaryAccessory = function(mac){
  var self = this;
  var uuid = UUIDGen.generate("iTunes:" + mac);
  var name = "iTunes";

  var newAccessory = new Accessory(name, uuid, 1); // 1 = Accessory.Category.OTHER
  newAccessory.context.iTunesMac = mac;

  newAccessory.addService(Service.Switch, "Playing State", "playstate").name = "playstate";
  newAccessory.addService(HomeKitMediaTypes.AudioDeviceService, name);
  newAccessory.addService(HomeKitMediaTypes.PlaybackDeviceService, name);
  newAccessory.addService(Service.Switch, "Track Skipper", "skiptrackforward").name = "skiptrackforward";
  newAccessory.addService(Service.Switch, "Album Skipper", "skipalbumforward").name = "skipalbumforward";

  newAccessory
  .getService(Service.AccessoryInformation)
  .setCharacteristic(Characteristic.Manufacturer, "Apple")
  .setCharacteristic(Characteristic.Model, "iTunes")
  .setCharacteristic(Characteristic.SerialNumber, mac);

  newAccessory.getService("playstate").getCharacteristic(Characteristic.On).displayName = "Playing";
  newAccessory.getService("skiptrackforward").getCharacteristic(Characteristic.On).displayName = "Track Skipper";
  newAccessory.getService("skipalbumforward").getCharacteristic(Characteristic.On).displayName = "Album Skipper";

  this.configureAccessory(newAccessory);

  this.api.registerPlatformAccessories("homebridge-itunes", "iTunes", [newAccessory]);

  // we came here from an aborted sync, start it again...
  this.syncAccessories();
}

ITunesPlatform.prototype.addAirPlayAccessory = function(rawDevice) {
  var self = this;
  var uuid = UUIDGen.generate(rawDevice.mac);

  var newAccessory = new Accessory(rawDevice.name, uuid, 1); // 1 = Accessory.Category.OTHER
  newAccessory.context.rawDevice = rawDevice;

  newAccessory.addService(Service.Switch, rawDevice.name);
  newAccessory.addService(HomeKitMediaTypes.AudioDeviceService, rawDevice.name);

  newAccessory
  .getService(Service.AccessoryInformation)
  .setCharacteristic(Characteristic.Manufacturer, "Apple")
  .setCharacteristic(Characteristic.Model, "AirPlay Speaker")
  .setCharacteristic(Characteristic.SerialNumber, rawDevice.mac);

  this.configureAccessory(newAccessory);

  this.api.registerPlatformAccessories("homebridge-itunes", "iTunes", [newAccessory]);
}

ITunesPlatform.prototype.removeAccessory = function(accessory) {
  if (accessory) {
    var mac = accessory.context.rawDevice.mac;
    this.api.unregisterPlatformAccessories("homebridge-itunes", "iTunes", [accessory]);
    delete this.accessories[mac];
  }
}
