(function(){
'use strict';

// GENERAL
const
	request = require( 'request' ),
	cheerio = require( 'cheerio' ),
	
	redText = `\x1b[31m%s\x1b[0m`,
	magentaText = `\x1b[35m%s\x1b[0m`,
	blueText = `\x1b[36m%s\x1b[0m`,
	yellowText = `\x1b[33m%s\x1b[0m`;
	
// Cute little bug
const spider = {
	// Config
	origin: null,
	destinations: [],
	oldDestinations: [],
	requestOptions: {},
	
	// Constructor
	awaken: ( config ) => {
		console.log( blueText, 'Spider is waking up in the drain spout...' );
		let self = Object.create( spider );
		
		self.origin = config.origin;
		self.destinations = [config.origin];
		self.requestOptions = config.requestOptions;
		
		return self;
	},
	
	// Initialize spider's journey
	crawl: function( ){
		// Validate origin url
		if ( new URL( this.origin ) ) this.spinWeb( );
		else console.log( 'Invalid origin! Spider is on strike.' );
	},
	
	// Assess next forward movement
	spinWeb: function( ){
		if ( this.destinations.length > 0 ){
			let options = Object.assign({},this.requestOptions);
			let current = this.destinations.length-1;
			options.url = this.destinations[current];
			
			request( options, ( err, response, body ) => {
				console.log( magentaText, `Visiting ${ options.url }...` );
		
				if (err) console.log( err ); // TODO save error logs
				else if ( response.statusCode !== 200 ) console.log( `Server responded with ${response.statusCode}` );
				else {
					this.forward( body );
				} } ); }
		else console.log( blueText, 'Spider ran out of web...' );
	},
	
	// Crawl a page and harvest data
	forward: function( body ){
		// add this destination to the visited list and remove it from the queue
		this.oldDestinations.push( this.destinations.pop() );
		
		let $ = cheerio.load( body )
		let content = this.harvestContent( $ );
		// console.log( magentaText, `Found content ${ content }` );
		let possibleDestinations = this.harvestDestinations( $ );
		
		for ( let i=0; i<possibleDestinations.length; i++ ){
			if ( this.oldDestinations.indexOf( possibleDestinations[i] ) === -1 && this.destinations.indexOf( possibleDestinations[i] ) === -1 ) {
					this.destinations.push( possibleDestinations[i] );
			}
		}
		
		// Delay spider's next visit
		setTimeout( this.spinWeb.bind( this ), 1000 );
	},
	
	// harvestContent : Object -> Array
	harvestContent: function( $ ){
		let pElements = $( 'p' ); // select all p elements from the fetched HTML
		let content = [];
		for ( let i=0; i<pElements.length; i++ ) {
			let text = $( pElements[i] ).text( ).split('\n'); // divide the p content into array elements
			
			for ( let j=0; j<text.length; j++ ) {
				if ( this.validate( text[j], 'string' ) ) {
					let cleaned = this.cleanText( text[j] );
					if ( cleaned ) content.push( cleaned );
				}
				// else console.log( redText,`COULD NOT VALIDATE [[${text[j]}]]` );
			}
		}
		
		return content;
	},
	
	// harvestDestinations : Object -> Array
	harvestDestinations: function( $ ){
		let aElements = $( 'a' );
		let links = [];
		for ( let i=0; i<aElements.length; i++ ) {
			let link = new URL( $( aElements[i] ).attr( 'href' ), this.origin );
			if ( this.isInternal( link ) ) links.push( link.toString() );
			// else console.log( redText,`EXTERNAL LINK [[${link}]]` );
		}
		
		return links;
	},
	
	// cleanText : String -> String
	cleanText: function( text ){
		const undesirables = [
			/\n+/g,
			/\s{2,}/g,
			/\t+/g,
			/\r+/g
		];
		
		for ( let i=0; i<undesirables.length; i++ ){
			text = text.replace( undesirables[i], '' );
		}
		return text !== '' ? text : null;
	},
	
	// isInternal : String -> Boolean
	isInternal: function( href ){
		const r = new RegExp( '^'+this.origin );
		return r.test( href );
	},
	
	// validate : a -> Boolean
	validate: function( input, type ){
		return input ? typeof input === type ? true : false : false; 
	}
}

module.exports = spider;
})();