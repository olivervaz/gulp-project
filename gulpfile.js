// for projects using pug/jade, font-awesome, sass, lint


const {series, parallel, watch, src, dest} = require('gulp');
const
    pug = require('gulp-pug'),
    sass = require('gulp-sass'),
    sourcemaps = require('gulp-sourcemaps'),
    gulpIf = require('gulp-if'),
    del = require('del'),
    newer = require('gulp-newer'), // checks dist directory, returns only new obj to pipeline
    plumber = require('gulp-plumber'), // for merging streams, has own "pipe" method
    autoprefixer = require('gulp-autoprefixer'),

    /*-----------DEVELOPMENT----------------*/
    debug = require('gulp-debug'),
    notify = require('gulp-notify'),
    browserSync = require('browser-sync').create(),

    /*--------------PRODUCTION---------------*/
    cleanCSS = require('gulp-clean-css'), //minifies css
    imagemin = require('gulp-imagemin'),
    htmlmin = require('gulp-htmlmin'),
    rev = require('gulp-rev'), //set hashes to filename (to avoid caching old style for users)
    uglify = require('gulp-uglify'),

    through2 = require('through2').obj,
    File = require('vinyl'),
    eslint = require('gulp-eslint'),
    fs = require('fs'),
    combine = require('stream-combiner2').obj;


const sassFiles = ['src/styles/**/*.sass'];
const pugFiles = ['src/pages/**/*.pug'];
const templatesFiles = ["./src/templates/**/*.pug"];
const imageFiles = ["src/img/**/*"];
const javascriptFiles = ["src/js-modules/**/*.js"];

// const isLive = process.env.NODE_ENV === 'live';
const isLive = true;


function getStaticUrl(url = '') {
    const baseUrl = process.env.STATIC_URL || './assets';
    return `${baseUrl}${url}`
}

function buildPug() {
    return src(pugFiles)
        .pipe(plumber({
            errorHandler: notify.onError() // error handler has each next stream
        }))
        .pipe(gulpIf(!isLive, sourcemaps.init()))
        .pipe(pug())
        .pipe(htmlmin())
        .pipe(gulpIf(!isLive, sourcemaps.write()))
        .pipe(dest('./dist'))
}

function buildSass() {
    return src(sassFiles)
        .pipe(plumber({
            errorHandler: notify.onError() // error handler has each next stream
        }))
        .pipe(gulpIf(!isLive, sourcemaps.init()))
        .pipe(sass({includePaths: ['node_modules']}))
        .pipe(autoprefixer())
        .pipe(gulpIf(isLive, cleanCSS()))
        .pipe(gulpIf(isLive, rev()))
        .pipe(gulpIf(!isLive, sourcemaps.write()))
        .pipe(dest('dist/assets/css/'))
        .pipe(gulpIf(isLive, rev.manifest(css.json)))
        .pipe(gulpIf(isLive, dest('manifest')))
}

function image() {
    return src(imageFiles)
        .pipe(newer('./dist/assets/img'))
        .pipe(gulpIf(isLive, imagemin()))
        .pipe(dest('./dist/assets/img/'))
}


function copyFontAwesomeSCSS() {
    return src('./node_modules/@fortawesome/fontawesome-free/scss/*.scss')
        .on('error', notify.onError())
        .pipe(dest('./src/styles/vendors/fontawesome'))
}


function copyFontAwesomeFonts() {
    return src('./node_modules/@fortawesome/fontawesome-free/webfonts/*')
        .on('error', notify.onError())
        .pipe(dest('./dist/assets/webfonts'))
}

function javascript() {
    return src(javascriptFiles)
        .pipe(plumber({
            errorHandler: notify.onError() // error handler has each next stream
        }))
        .pipe(gulpIf(!isLive, sourcemaps.init()))
        .pipe(gulpIf(isLive, uglify()))
        .pipe(gulpIf(!isLive, sourcemaps.init()))
        .pipe(dest('./dist/assets/js-modules/'))
}

function lint() {
    /*run eslint checkings, ignore files that weren`t changed*/

    let eslintResults = {};
    let cachedFilePath = process.cwd() + '/tmp/cache-eslint.json';

    try {
        eslintResults = JSON.parse(fs.readFileSync(cachedFilePath));
    } catch (e) {
        console.log(e);
    }
    return src(javascriptFiles, {read: false})
        .pipe(gulpIf(function (file) {

                //check if file data is in cached File and file wasn`t modified since last check

                return eslintResults[file.path]
                    && eslintResults[file.path].mtime === file.stat.mtime.toJSON()
            },
            through2(function (file, env, callback) {

                //if true

                file.eslint = eslintResults[file.path].eslint;
                callback(null, file)
            }),
            combine(
                //if false
                through2(function (file, enc, callback) {
                    //read file
                    file.contents = fs.readFileSync(file.path);
                    callback(null, file);
                }),
                eslint(),
                through2(function (file, env, callback) {
                    // write result
                    eslintResults[file.path] = {
                        eslint: file.eslint,
                        mtime: file.stat.mtime
                    };
                    callback(null, file);
                })
            )
        ))
        .pipe(eslint.format())
        .on('end', function () {
            // update cached file
            fs.writeFileSync(cachedFilePath, JSON.stringify((eslintResults)))
        })
}

function clean() {
    return del('./dist')
}

function serve() {
    browserSync.init({
        server: {baseDir: "./dist"},
        port: "3000"
    });
    browserSync.watch('./dist/**/*.*').on('change', browserSync.reload);

    watch(pugFiles, buildPug);
    watch(templatesFiles, buildPug());
    watch(sassFiles, buildSass);
    watch(imageFiles, image);
    watch(javascriptFiles, javascript);
}


const build = series(
    clean,
    parallel(
        series(copyFontAwesomeSCSS, copyFontAwesomeFonts),
        buildSass,
        buildPug,
        image,
        javascript,
    )
);

exports.clean = clean;
exports.sass = sass;
exports.lint = lint;
exports.build = build;
exports.default = series(build, serve);
