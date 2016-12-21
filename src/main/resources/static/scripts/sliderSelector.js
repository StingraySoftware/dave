
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
                  '<h3>' + title + '</h3>' +
                  '<input id="from_' + this.id + '" type="text" name="from_' + this.id + '" placeholder="' + fromLabel + '" value="' + fromValue + '" />' +
                  '<input id="to_' + this.id + '" type="text" name="to_' + this.id + '" placeholder="' + toLabel + '" value="' + toValue + '" />' +
                  '<div id="slider-' + this.id + '"></div>' +
                '</div>');

  //Caches the inputs for further use
  this.fromInput = this.$html.find("#from_" + this.id);
  this.toInput = this.$html.find("#to_" + this.id);

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

   log ("new sliderSelector id: " + this.id + ", fromValue: " + this.fromValue + ", toValue: " + this.toValue);

 return this;
}
