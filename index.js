var applescript = require('applescript');
var Accessory, Service, Characteristic, UUIDGen;

module.exports = function(homebridge) {
  Accessory = homebridge.platformAccessory;
  Service = homebridge.hap.Service;
  Characteristic = homebridge.hap.Characteristic;
  UUIDGen = homebridge.hap.uuid;

  homebridge.registerPlatform("homebridge-itunes", "iTunes", ITunesPlatform, true);

  ITunesPlatform.AudioVolume = function() {
    Characteristic.call(this, 'Audio Volume', '00001001-0000-1000-8000-135D67EC4377');
    this.setProps({
      format: Characteristic.Formats.UINT8,
      unit: Characteristic.Units.PERCENTAGE,
      maxValue: 100,
      minValue: 0,
      minStep: 1,
      perms: [Characteristic.Perms.READ, Characteristic.Perms.WRITE, Characteristic.Perms.NOTIFY]
    });
    this.value = this.getDefaultValue();
  };

  /*
  ITunesPlatform.Muting = function() {
    Characteristic.call(this, 'Muting', '00001002-0000-1000-8000-135D67EC4377');
    this.setProps({
      format: Characteristic.Formats.UINT8,
      perms: [Characteristic.Perms.READ, Characteristic.Perms.WRITE, Characteristic.Perms.NOTIFY]
    });
    this.value = this.getDefaultValue();
  };
  */

  ITunesPlatform.AudioDeviceService = function(displayName, subtype) {
    Service.call(this, displayName, '00000001-0000-1000-8000-135D67EC4377', subtype);

    // Required Characteristics
    this.addCharacteristic(ITunesPlatform.AudioVolume);

    // Optional Characteristics
    this.addOptionalCharacteristic(ITunesPlatform.Muting);
  };
}

function ITunesPlatform(log, config, api) {
  var self = this;

  self.log = log;
  self.config = config || { "platform": "iTunes" };

applescript.execString('tell application "iTunes" to get current AirPlay devices', function(err, rtn){ if(err) log(err); else log(rtn);});
  // Get the id and name of all the AirPlay devices...
  var tell = 'tell application "iTunes"\n'
      + 'set apDevMap to {}\n'
      + 'repeat with aDevice in (AirPlay devices)\n'
        + 'copy {id:aDevice\'s id, name:aDevice\'s name, mac:aDevice\'s network address} to the end of the apDevMap\n'
      + 'end repeat\n'
      + 'get apDevMap\n'
  + 'end tell\n';

  applescript.execString(tell, function(err, rtn) {
    if (err) {
      log(err);
    }
    if (Array.isArray(rtn)) {
      self.rawDevices = rtn;
      if(self.isFinishedLaunching) self.initializeAccessories();
    }
  });

  self.accessories = {};

  if (api) {
    self.api = api;

    self.api.on('didFinishLaunching', self.didFinishLaunching.bind(this));
  }
}

ITunesPlatform.prototype.configureAccessory = function(accessory) {
  var self = this;

  accessory.reachable = true
  accessory
    .getService(Service.Switch)
    .getCharacteristic(Characteristic.On)
    .setValue(0);
}

ITunesPlatform.prototype.didFinishLaunching = function() {
  this.isFinishedLaunching = true;
  if(this.rawDevices) this.initializeAccessories();
}

ITunesPlatform.prototype.initializeAccessories = function() {

  for (var i = 0; i < self.rawDevices.length; i++) {
    var rawDevice = self.rawDevices[i];
    if(!rawDevice.mac) rawDevice.mac = '00-host-audio';
    if (!self.accessories[rawDevice.mac]) {
      self.addAccessory(rawDevice);
    }
  }

}

/*
ITunesPlatform.prototype.dashEventWithAccessory = function(accessory) {
  var targetChar = accessory
    .getService(Service.StatelessProgrammableSwitch)
    .getCharacteristic(Characteristic.ProgrammableSwitchEvent);

  targetChar.setValue(1);
  setTimeout(function(){targetChar.setValue(0);}, 10000);
}
*/

ITunesPlatform.prototype.addAccessory = function(rawDevice) {
  var self = this;
  var uuid = UUIDGen.generate(rawDevice.mac);

  var newAccessory = new Accessory(rawDevice.name, uuid, 15);
  newAccessory.context.mac = rawDevice.mac;

  newAccessory.addService(Service.Switch, rawDevice.name);
  newAccessory.addService(ITunesPlatform.AudioDeviceService, rawDevice.name);

  newAccessory
  .getService(Service.AccessoryInformation)
  .setCharacteristic(Characteristic.Manufacturer, "Apple")
  .setCharacteristic(Characteristic.Model, "AirPlay Speaker")
  .setCharacteristic(Characteristic.SerialNumber, rawDevice.mac);

  newAccessory
  .getService(Service.Switch)
  .getCharacteristic(Characteristic.On)
  .on('get', function(callback){
    var tell = 'tell application "iTunes" to set theResult to selected of (AirPlay device id ' + parseInt(rawDevice.id) + ')';
    applescript.execString(tell, function(err, rtn) {
      if (err) {
        callback(err);
      }
      callback(false, rtn);
    });
  })
  .on('set', function(newVal, callback){
    var tell = 'tell application "iTunes" to set selected of (AirPlay device id ' + parseInt(rawDevice.id) + ') to ' + (newVal ? 'true' : 'false');
    applescript.execString(tell, function(err, rtn) {
      if (err) {
        callback(err);
      }
      callback(false, rtn);
    });
  });

  newAccessory
  .getService(ITunesPlatform.AudioDeviceService)
  .getCharacteristic(ITunesPlatform.AudioVolume)
  .on('get', function(callback){
    var tell = 'tell application "iTunes" to set theResult to sound volume of (AirPlay device id ' + parseInt(rawDevice.id) + ')';
    applescript.execString(tell, function(err, rtn) {
      if (err) {
        callback(err);
      }
      callback(false, rtn);
    });
  })
  .on('set', function(newVal, callback){
    var tell = 'tell application "iTunes" to set sound volume of (AirPlay device id ' + parseInt(rawDevice.id) + ') to ' + parseInt(newVal);
    applescript.execString(tell, function(err, rtn) {
      if (err) {
        callback(err);
      }
      callback(false);
    });
  })

  this.accessories[rawDevice.mac] = newAccessory;
  this.api.registerPlatformAccessories("homebridge-itunes", "iTunes", [newAccessory]);
}

ITunesPlatform.prototype.removeAccessory = function(accessory) {
  if (accessory) {
    var mac = accessory.context.mac;
    this.api.unregisterPlatformAccessories("homebridge-itunes", "iTunes", [accessory]);
    delete this.accessories[mac];
  }
}
