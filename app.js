angular.module('MasterBuilder', [])

  .value('availableFields', [
    'version', 'type', 'currency_identifier', 'number_of_coins', 'number_of_blocks',
    'action', 'ecosystem', 'property_type', 'text', 'timestamp', 'percentage'
  ])

  .service('Parser', function() {
    var normalize = function(value, min, max) {
      value = Math.max(value, min);
      value = Math.min(value, max);

      return isNaN(value) ? 0 : value;
    };

    var service = {
      toHex8: function(value) {
        value = normalize(value, 0, 255);

        return ('00' + value.toString(16)).slice(-2);
      },

      toHex16: function(value) {
        value = normalize(value, 0, 65535);

        return ('0000' + value.toString(16)).slice(-4);
      },

      toHex32: function(value) {
        value = normalize(value, 0, 4294967295);

        return ('00000000' + value.toString(16)).slice(-8);
      },

      toHex64: function(value) {
        value = value || '0';
        value = value.toString();
        value = value.replace(/[^0-9]/gi, '');
        value = new BigInteger(value);

        return ('0000000000000000' + value.toString(16)).slice(-16).toLowerCase();
      },

      toHexStr: function(str) {
        var result = '';
        str = str || '';
        str = str.toString();

        for (var i = 0; i < str.length; i++) {
          var hex = str.charCodeAt(i).toString(16);
          result += ('00' + hex).slice(-2);
        }

        return result += '00';
      },

      hexToStr: function(hex) {
        var str = '';
        hex = hex || '';
        hex = hex.toString();
        hex = hex.replace(/[^0-9a-f]/gi, '');

        for (var i = 0; i < hex.length - 2; i += 2) {
          str += String.fromCharCode(parseInt(hex.substr(i, 2), 16));
        }

        return str;
      },

      parse: function(value, type) {
        switch (type) {
          case 'uint8':
          case 'number_of_blocks':
          case 'action':
          case 'ecosystem':
          case 'percentage':
            return this.toHex8(value);

          case 'uint16':
          case 'version':
          case 'type':
          case 'property_type':
            return this.toHex16(value);

          case 'uint32':
          case 'currency_identifier':
            return this.toHex32(value);

          case 'uint64':
          case 'number_of_coins':
          case 'timestamp':
            return this.toHex64(value);

          case 'text':
          default:
            return this.toHexStr(value);
        }
      }
    };

    return service;
  })

  .factory('Field', function() {
    var Field = function(field) {
      field.type = field.type || 'text';
      field.min = field.min || 0;
      field.max = field.max || 18446744073709551615;
      field.minlength = field.minlength || 1;
      field.maxlength = field.maxlength || 255;
      field.placeholder = field.placeholder || '';
      field.pattern = field.pattern || /^\d+$/;
      field.required = field.required || true;

      switch (field.field_type) {
        case 'uint8':
        case 'number_of_blocks':
        case 'action':
        case 'ecosystem':
        case 'percentage':
          field.field_value = parseInt(field.field_value);
          field.type = 'number';
          field.max = 255;
          field.field_value = Math.min(field.field_value, field.max);
          field.placeholder = '2';
          break;

        case 'uint16':
        case 'version':
        case 'type':
        case 'property_type':
          field.field_value = parseInt(field.field_value);
          field.type = 'number';
          field.max = 65535;
          field.field_value = Math.min(field.field_value, field.max);
          field.placeholder = '0';
          break;

        case 'uint32':
        case 'currency_identifier':
          field.field_value = parseInt(field.field_value);
          field.type = 'number';
          field.max = 4294967295;
          field.field_value = Math.min(field.field_value, field.max);
          field.placeholder = '1';
          break;

        case 'uint64':
        case 'number_of_coins':
        case 'timestamp':
          field.maxlength = 20;
          field.pattern = /^\d{1,20}$/;
          field.placeholder = '100000000';
          break;

        case 'text':
          field.field_value = field.field_value.toString();
          field.pattern = /^.{0,255}$/;
          field.minlength = 0;
          field.required = false;
          field.placeholder = 'A few words..';

        default:
          break;
      }

      this.field_value = field.field_value;
      this.field_type = field.field_type;
      this.type = field.type;
      this.min = field.min;
      this.max = field.max;
      this.minlength = field.minlength;
      this.maxlength = field.maxlength;
      this.placeholder = field.placeholder;
      this.pattern = field.pattern;
      this.required = field.required;
    };

    return Field;
  })

  .controller('CreateTxController', ['$scope', 'Parser', 'Field', 'availableFields',
    function($scope, Parser, Field, availableFields) {

    $scope.fields = [];
    $scope.sender = '';
    $scope.reference = '';

    $scope.init = function() {
      var query = window.location.search.replace(/[^a-z0-9_&=]/gi, '');

      if (query.length > 0) {
        $scope.loadFromQuery(query);
      } else {
        $scope.resetForm();
      }
    };

    $scope.getRawTx = function() {
      var hex = '';

      angular.forEach($scope.fields, function(field) {
        hex += Parser.parse(field.field_value, field.field_type);
      });

      return hex;
    };

    $scope.addField = function() {
      ga('send', 'event', 'button', 'click', 'add-field');

      var type = availableFields[($scope.fields.length % availableFields.length)];
      var field = $scope.createField(type, '');

      $scope.fields.push(field);
    };

    $scope.removeField = function() {
      ga('send', 'event', 'button', 'click', 'remove-field');

      $scope.fields.pop();
    };

    $scope.loadFromQuery = function(query) {
      $scope.fields = [];

      angular.forEach(query.split('&'), function(params) {
        fsplit = params.split('=');

        if (fsplit.length != 2) {
          return;
        }

        var field_type = fsplit[0];
        var field_value = fsplit[1];

        if ('text' === field_type) {
          field_value = Parser.hexToStr(field_value);
        }

        if ('sender' === field_type) {
          $scope.sender = field_value;
        } else if ('reference' === field_type) {
          $scope.reference = field_value;
        } else {
          $scope.fields.push($scope.createField(field_type, field_value));
        }
      });
    };

    $scope.buildQuery = function() {
      var query = '';

      angular.forEach($scope.fields, function(field) {
          query += (query != '' ? '&' : '?');

          if (field.field_type != 'text') {
            query += field.field_type + '=' + field.field_value;
          } else {
            query += field.field_type + '=' + Parser.parse(field.field_value, field.field_type);
          }
      });

      if ($scope.sender.length > 27) {
        query += '&sender=' + $scope.sender;
      }

      if ($scope.reference.length > 27) {
        query += '&reference=' + $scope.reference;
      }

      query = query.replace(/NaN/gi, '');
      query = query.replace(/null/gi, '');
      query = query.replace(/undefined/gi, '');

      return query;
    };

    $scope.createField = function(type, value) {
      return new Field({field_type: type, field_value: value});
    };

    $scope.submitForm = function() {
      ga('send', 'event', 'button', 'click', 'store-in-url');

      var query = $scope.buildQuery();
      var full = window.location.origin + window.location.pathname + query;

      window.location.assign(full);
    };

    $scope.replaceField = function(index) {
      var oldField = $scope.fields[index];
      var newField = $scope.createField(oldField.field_type, oldField.field_value);

      $scope.fields[index] = newField;
    };

    $scope.clearForm = function() {
      angular.forEach($scope.fields, function(field) {
        field.field_value = '';
      });

      $scope.sender = '';
      $scope.reference = '';
    };

    $scope.resetForm = function() {
      $scope.fields = [
        $scope.createField('version', 0),
        $scope.createField('type', 0),
        $scope.createField('currency_identifier', 1),
        $scope.createField('number_of_coins', '115000000')
      ];

      $scope.sender = 'mvayzbj425X55kRLLPQiuCXWUED6LMP65C';
      $scope.reference = 'n4EmA9R4VmxLnxu9G8yZMDxvBBha8bUtEQ';
    };
 }]);
