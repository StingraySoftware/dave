
function BinSelector(id, title, fromLabel, fromValue, toValue, step, initValue, onSelectorValuesChangedFn) {

  var currentObj = this;
  this.id = id.replace(/\./g,'');
  this.title = title;
  this.fromLabel = fromLabel;
  this.initFromValue = fromValue;
  this.initToValue = toValue;
  this.fromValue = fromValue;
  this.toValue = toValue;
  this.value = initValue;
  this.step = step;
  this.onSelectorValuesChanged = onSelectorValuesChangedFn;
  this.onSelectorEnabledChanged = null;

  this.$html = $('<div class="sliderSelector ' + this.id + '">' +
                  '<h3>' +
                    title +
                    '<div class="switch-wrapper">' +
                    '  <div id="switch_' + this.id + '" class="switch-btn fa fa-plus-square" aria-hidden="true"></div>' +
                    '</div>' +
                  '</h3>' +
                  '<div class="selectorContainer">' +
                  ' <input id="from_' + this.id + '" class="selectorFrom" type="text" name="from_' + this.id + '" placeholder="' + fromLabel + '" value="' + fromValue + '" />' +
                  ' <div id="slider-' + this.id + '" class="selectorSlider"></div>' +
                  '</div>' +
                '</div>');

  //Caches the controls for further use
  this.container = this.$html.find(".selectorContainer");
  this.switchBox = this.$html.find("#switch_" + this.id);
  this.fromInput = this.$html.find("#from_" + this.id);
  this.slider = this.$html.find("#slider-" + this.id);

  this.switchBox.parent().hide();

  this.setTitle = function (title) {
    this.title = title;
    this.$html.find("h3").first().html(title);
  }

  this.setDisableable = function (disableable) {
    this.switchBox.parent().show();
  }

  this.inputChanged = function ( event ) {
    currentObj.setValues( currentObj.fromInput.val() );
    currentObj.onSelectorValuesChanged();
  };
  this.fromInput.on('input', this.inputChanged);

  //Creates the slider
  this.slider.slider({
         min: this.fromValue,
         max: this.toValue,
         values: [this.value],
         step: this.step,
         slide: function( event, ui ) {
           var sliderId = event.target.id.replace("slider-", "");
           var tab = getTabForSelector(sliderId);
           if (tab != null){
             tab.toolPanel.binSelector.setValues( ui.values[ 0 ], "slider");
             tab.toolPanel.binSelector.onSelectorValuesChanged();
           }
         }
     });

   //Set values method
   this.setValues = function (value, source) {
     this.value = Math.min(Math.max(parseFloat(value), this.initFromValue), this.initToValue);
     this.fromInput.val( this.value );
     if (source != "slider") {
       this.slider.slider('values', 0, this.value);
     }

     var tab = getTabForSelector(this.id);
     if (!isNull(tab)) {
       tab.projectConfig.binSize = this.value;
       if (tab.projectConfig.binSizeCouldHaveAliasing()) {
         this.showWarn("Aliasing/Moire effects could rise");
       } else {
         this.showWarn("");
       }
       log("New BinSize set: " + tab.projectConfig.binSize);
     }
   }

   this.setEnabled = function (enabled) {
     this.enabled = enabled;
     if (enabled) {
       this.switchBox.switchClass("fa-plus-square", "fa-minus-square");
       this.container.fadeIn();
     } else {
       this.switchBox.switchClass("fa-minus-square", "fa-plus-square");
       this.setValues( this.value );
       this.container.fadeOut();
     }
   }

   this.showWarn = function (msg) {
     this.$html.find(".btnWarn").remove();
     if (!isNull(msg) && msg != ""){
       this.$html.append($('<a href="#" class="btn btn-danger btnWarn"><div>' +
                                       '<i class="fa fa-exclamation-triangle" aria-hidden="true"></i> ' + msg +
                                     '</div></a>'));
     }
   }

   //Init from-to values
   this.setValues( this.value );

   log ("new binSelector id: " + this.id + ", Value: " + this.value + ", fromValue: " + this.fromValue + ", toValue: " + this.toValue + ", step: " + this.step);

   return this;
}
