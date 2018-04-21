// Run tasks with $ ./node_modules/.bin/gulp
require('es6-promise').polyfill();

var gulp = require('gulp'),
    gettext = require('gulp-angular-gettext'),
    argv = require('yargs').argv,
    concat = require('gulp-concat'),
    gulpif = require('gulp-if'),
    path = require('path'),
    uglify = require('gulp-uglify'),
    mainBowerFiles = require('main-bower-files'),
    sourcemaps = require('gulp-sourcemaps'),
    templateCache = require('gulp-angular-templatecache');

/**
 * Default tasks to be run before start.
 */

// Catches all template files concats them to one file js/templates.js.
gulp.task('templates', function () {
    return gulp.src(path.join('**', 'static', 'templates', '**', '*.html'))
        .pipe(templateCache('templates.js', {
            module: 'OpenSlidesApp.openslides_conversations.templates',
            standalone: true,
            moduleSystem: 'IIFE',
            transformUrl: function (url) {
                var pathList = url.split(path.sep);
                pathList.shift();
                return pathList.join(path.sep);
            },
        }))
        .pipe(gulp.dest(path.join('static', 'js', 'openslides_conversations')));
});

// Catches all JavaScript files from all bower components and concats them to
// one file js/openslides-libs.js. In production mode the file is uglified.
gulp.task('js-libs', function () {
    return gulp.src(mainBowerFiles({
            filter: /\.js$/
        }))
        .pipe(sourcemaps.init())
        .pipe(concat('openslides-conversations.js'))
        .pipe(sourcemaps.write())
        .pipe(gulpif(argv.production, uglify()))
        .pipe(gulp.dest(path.join('static', 'js', 'openslides_conversations')));
        // .pipe(gulp.dest(path.join(output_directory, 'js')));
});

// Compiles translation files (*.po) to *.json and saves them in the directory 'i18n'.
gulp.task('translations', function () {
    return gulp.src(path.join('openslides_conversations', 'locale', 'angular-gettext', '*.po'))
        .pipe(gettext.compile({
            format: 'json'
        }))
        .pipe(gulp.dest(path.join('static', 'i18n', 'openslides_conversations')));
});

// Gulp default task. Runs all other tasks before.
gulp.task('default', ['translations', 'templates', 'js-libs'], function () {});

// Watches changes in JavaScript and templates.
 gulp.task('watch', ['templates'], function   () {
    gulp.watch([
        path.join('**', 'static', 'templates', '**', '*.html')
    ], ['templates']);
 });

/**
 * Extra tasks that have to be called manually. Useful for development.
 */

// Extracts translatable strings using angular-gettext and saves them in file
// locale/angular-gettext/template-en.pot.
gulp.task('pot', function () {
    return gulp.src([
            'openslides_conversations/static/templates/*/*.html',
            'openslides_conversations/static/js/*/*.js',
        ])
        .pipe(gettext.extract('template-en.pot', {}))
        .pipe(gulp.dest(path.join('openslides_conversations', 'locale', 'angular-gettext')));
});

// Checks JavaScript using JSHint
gulp.task('jshint', function () {
    return gulp.src([
            'gulpfile.js',
            path.join('openslides_conversations', 'static', 'js', 'openslides_conversations', '*.js'),
        ])
        .pipe(jshint())
        .pipe(jshint.reporter('default'))
        .pipe(jshint.reporter('fail'));
});
