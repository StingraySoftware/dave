
function BinSelector(id, title, fromLabel, fromValue, toValue, step, initValue, onSelectorValuesChangedFn) {

  var currentObj = this;
  this.id = id;
  this.title = title;
  this.fromLabel = fromLabel;
  this.initFromValue = fromValue;
  this.initToValue = toValue;
  this.fromValue = fromValue;
  this.toValue = toValue;
  this.value = initValue;
  this.step = step;
  this.onSelectorValuesChanged = onSelectorValuesChangedFn;

  this.$html = $('<div class="sliderSelector ' + this.id + '">' +
                  '<h3>' + title + '</h3>' +
                  '<div class="selectorContainer">' +
                  ' <input id="from_' + this.id + '" class="selectorFrom" type="text" name="from_' + this.id + '" placeholder="' + fromLabel + '" value="' + fromValue + '" />' +
                  ' <div id="slider-' + this.id + '" class="selectorSlider"></div>' +
                  '</div>' +
                '</div>');

  //Caches the controls for further use
  this.container = this.$html.find(".selectorContainer");
  this.fromInput = this.$html.find("#from_" + this.id);
  this.slider = this.$html.find("#slider-" + this.id);

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
           tab.toolPanel.binSelector.setValues( ui.values[ 0 ], "slider");
           tab.toolPanel.binSelector.onSelectorValuesChanged();
         }
     });

   //Set values method
   this.setValues = function (value, source) {
     this.value = value;
     this.fromInput.val( this.value );
     if (source != "slider") {
       this.slider.slider('values', 0, this.value);
     }

     var tab = getTabForSelector(this.id);
     if (!isNull(tab)) {
       tab.projectConfig.binSize = this.value;
       log("New BinSize set: " + tab.projectConfig.binSize);
     }
   }

   //Init from-to values
   this.setValues( this.value );

   log ("new binSelector id: " + this.id + ", Value: " + this.value + ", fromValue: " + this.fromValue + ", toValue: " + this.toValue + ", step: " + this.step);

   return this;
}
