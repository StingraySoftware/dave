
var sliderSelectors_array = [];

function sliderSelector(id, title, fromLabel, toLabel, fromValue, toValue) {

  var currentObj = this;
  this.id = id;
  this.title = title;
  this.fromLabel = fromLabel;
  this.toLabel = toLabel;
  this.fromValue = fromValue;
  this.toValue = toValue;

  sliderSelectors_array[this.id] = this;

  this.$html = $('<div class="sliderSelector ' + this.id + '">' +
                  '<h3>' + title +
                  '<div class="switch-wrapper">' +
                  '  <input id="switch_' + this.id + '" type="checkbox">' +
                  '</div>' +
                  '</h3>' +
                  '<div class="selectorContainer">' +
                  ' <input id="from_' + this.id + '" class="selectorFrom" type="text" name="from_' + this.id + '" placeholder="' + fromLabel + '" value="' + fromValue + '" />' +
                  ' <input id="to_' + this.id + '" class="selectorTo" type="text" name="to_' + this.id + '" placeholder="' + toLabel + '" value="' + toValue + '" />' +
                  ' <div id="slider-' + this.id + '" class="selectorSlider"></div>' +
                  '</div>' +
                '</div>');

  //Caches the controls for further use
  this.container = this.$html.find(".selectorContainer");
  this.switchBox = this.$html.find("#switch_" + this.id);
  this.fromInput = this.$html.find("#from_" + this.id);
  this.toInput = this.$html.find("#to_" + this.id);

  //Prepares switchBox
  this.switchBox.click( function ( event ) {
    var switchId = event.target.id.replace("switch_", "");
    if (this.checked) {
      sliderSelectors_array[switchId].container.fadeIn();
    } else {
      sliderSelectors_array[switchId].container.fadeOut();
    }
  });

  //Creates the slider
  this.$html.find("#slider-" + this.id).slider({
         range:true,
         min: this.fromValue,
         max: this.toValue,
         values: [ fromValue, toValue ],
         slide: function( event, ui ) {
           var sliderId = event.target.id.replace("slider-", "");
           sliderSelectors_array[sliderId].setValues( ui.values[ 0 ], ui.values[ 1 ]);
         }
     });

   //Set values method
   this.setValues = function (from, to) {
     this.fromValue = from;
     this.toValue = to;
     this.fromInput.val( this.fromValue );
     this.toInput.val( this.toValue );
     //log("sliderSelector.setValues id: " + this.id + ", fromValue: " + this.fromValue + ", toValue: " + this.toValue)
   }
   this.setValues( this.fromValue, this.toValue );

   //Collapses container
   this.container.hide();

   log ("new sliderSelector id: " + this.id + ", fromValue: " + this.fromValue + ", toValue: " + this.toValue);

 return this;
}

function clear_sliderSelectors (){
  sliderSelectors_array = [];
  $(".sliderSelector").remove();
}
