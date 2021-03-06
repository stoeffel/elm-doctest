/** allow to use Elm from nodejs...
 */
const debug = false
const path = require('path')
const vm = require('vm')
const fs = require('fs')
const proc = require('process')
const exec = require('child_process').execSync

// extract source folder from elm-package.json
const cwd = (() => {
	try {
		const data = fs.readFileSync('elm-package.json' )
		return JSON.parse( data )['source-directories'][0]
	} catch (e) {
		return './'
	}
})()
const testfilename = path.resolve(cwd, './DoctestTempModule__.elm')

function log( o ) {
	console.log( o )
}
if ( debug ) log('############## debug mode is ON ##############')

/** loads Elm compiled javascript
 * and returns Elm object
 */
function loadElm( path ) {
	const data = fs.readFileSync( path )
	const context = { console, setInterval, setTimeout, setImmediate }
	vm.runInNewContext( data, context, path )
	return context.Elm
}

/** main */
const Elm = loadElm(path.resolve(__dirname, '../distribution/index.js'))
const app = Elm.Main.worker()

console.log('Starting elm-doctest ...')
if ( proc.argv.length != 3 ) {
	console.error('need provide elm source file path')
	process.exit( 1 )
}
const elmfile = proc.argv[ 2 ]
try {
	const elmsrc = fs.readFileSync( elmfile, 'utf8')
	setTimeout(() => {  // for some reason, port does not work without delay.
		app.ports.srccode.send( elmsrc )
	}, 1)
} catch(e) {
	log(e)
	process.exit( 1 )
}

app.ports.evaluate.subscribe(function( resource ) {
	if ( debug ) {
		log('----------- evaluate called.')
		log(resource)
	}
	if ( resource.src.length == 0 ) return
	// log('writing temporary source into file...')
	fs.writeFileSync(testfilename, resource.src )
	const stdout = exec('elm-repl', { input: resource.runner, encoding: 'utf8'})
	if ( debug ) log( stdout )
	const match = stdout.match(/^> (.+)/gm)
	if ( !match ) return []
	const resultStr = match[0].replace(/[^"]*(".+")( : .*)?/, '$1')
	if ( debug ) log( resultStr )
	app.ports.result.send({ stdout: JSON.parse( resultStr ), filename: elmfile })
	if ( !debug && fs.existsSync( testfilename ))
		fs.unlinkSync( testfilename )
})

app.ports.report.subscribe(function( report ) {
	if ( report.text.length == 0 ) return
	log( report.text )
	if ( report.failed ) process.exit(1)
	process.exit()
})

