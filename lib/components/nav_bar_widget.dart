import '';
import '/flutter_flow/flutter_flow_theme.dart';
import '/flutter_flow/flutter_flow_util.dart';
import 'dart:ui';
import '/index.dart';
import 'package:flutter/material.dart';
import 'package:flutter/scheduler.dart';
import 'nav_bar_model.dart';
export 'nav_bar_model.dart';

class NavBarWidget extends StatefulWidget {
  const NavBarWidget({super.key});

  @override
  State<NavBarWidget> createState() => _NavBarWidgetState();
}

class _NavBarWidgetState extends State<NavBarWidget> {
  late NavBarModel _model;

  @override
  void setState(VoidCallback callback) {
    super.setState(callback);
    _model.onUpdate();
  }

  @override
  void initState() {
    super.initState();
    _model = createModel(context, () => NavBarModel());

    // On component load action.
    SchedulerBinding.instance.addPostFrameCallback((_) async {
      _model.number = 0;
      safeSetState(() {});
    });
  }

  @override
  void dispose() {
    _model.maybeDispose();

    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Align(
      alignment: AlignmentDirectional(0.0, 1.0),
      child: Material(
        color: Colors.transparent,
        elevation: 1.0,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(12.0),
        ),
        child: Container(
          width: double.infinity,
          decoration: BoxDecoration(
            color: FlutterFlowTheme.of(context).accent1,
            borderRadius: BorderRadius.circular(12.0),
            border: Border.all(
              color: FlutterFlowTheme.of(context).alternate,
              width: 1.0,
            ),
          ),
          child: ClipRRect(
            borderRadius: BorderRadius.circular(12.0),
            child: BackdropFilter(
              filter: ImageFilter.blur(
                sigmaX: 2.0,
                sigmaY: 2.0,
              ),
              child: Padding(
                padding: EdgeInsets.all(6.0),
                child: Row(
                  mainAxisSize: MainAxisSize.max,
                  mainAxisAlignment: MainAxisAlignment.center,
                  crossAxisAlignment: CrossAxisAlignment.center,
                  children: [
                    Expanded(
                      child: AnimatedContainer(
                        duration: Duration(milliseconds: 200),
                        curve: Curves.easeInOut,
                        decoration: BoxDecoration(
                          color: valueOrDefault<Color>(
                            _model.number == 0
                                ? Color(0x1FFFFFFF)
                                : Color(0x00FFFFFF),
                            Color(0x1FFFFFFF),
                          ),
                          borderRadius: BorderRadius.circular(12.0),
                        ),
                        child: Padding(
                          padding: EdgeInsets.all(6.0),
                          child: InkWell(
                            splashColor: Colors.transparent,
                            focusColor: Colors.transparent,
                            hoverColor: Colors.transparent,
                            highlightColor: Colors.transparent,
                            onTap: () async {
                              _model.number = 0;
                              safeSetState(() {});

                              context.goNamed(HomePageWidget.routeName);
                            },
                            child: Column(
                              mainAxisSize: MainAxisSize.min,
                              mainAxisAlignment: MainAxisAlignment.center,
                              children: [
                                Icon(
                                  Icons.home_rounded,
                                  color: valueOrDefault<Color>(
                                    _model.number == 0
                                        ? Colors.white
                                        : FlutterFlowTheme.of(context)
                                            .secondaryText,
                                    FlutterFlowTheme.of(context).accent1,
                                  ),
                                  size: 23.0,
                                ),
                                Padding(
                                  padding: EdgeInsetsDirectional.fromSTEB(
                                      0.0, 5.0, 0.0, 0.0),
                                  child: Text(
                                    FFLocalizations.of(context).getText(
                                      'g0osur7n' /* Главная */,
                                    ),
                                    style: FlutterFlowTheme.of(context)
                                        .bodyLarge
                                        .override(
                                          fontFamily: 'Ubuntu',
                                          color: valueOrDefault<Color>(
                                            _model.number == 0
                                                ? Colors.white
                                                : FlutterFlowTheme.of(context)
                                                    .secondaryText,
                                            FlutterFlowTheme.of(context)
                                                .accent1,
                                          ),
                                          fontSize: 10.0,
                                          letterSpacing: 0.0,
                                          fontWeight: FontWeight.w500,
                                        ),
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ),
                      ),
                    ),
                    Expanded(
                      child: AnimatedContainer(
                        duration: Duration(milliseconds: 200),
                        curve: Curves.easeInOut,
                        decoration: BoxDecoration(
                          color: valueOrDefault<Color>(
                            _model.number == 1
                                ? Color(0x1FFFFFFF)
                                : Color(0x00FFFFFF),
                            Color(0x00FFFFFF),
                          ),
                          borderRadius: BorderRadius.circular(12.0),
                        ),
                        child: Padding(
                          padding: EdgeInsets.all(6.0),
                          child: InkWell(
                            splashColor: Colors.transparent,
                            focusColor: Colors.transparent,
                            hoverColor: Colors.transparent,
                            highlightColor: Colors.transparent,
                            onTap: () async {
                              _model.number = 1;
                              safeSetState(() {});

                              context.goNamed(MissionPageWidget.routeName);
                            },
                            child: Column(
                              mainAxisSize: MainAxisSize.min,
                              mainAxisAlignment: MainAxisAlignment.center,
                              children: [
                                Icon(
                                  Icons.remove_red_eye_rounded,
                                  color: valueOrDefault<Color>(
                                    _model.number == 1
                                        ? Colors.white
                                        : FlutterFlowTheme.of(context)
                                            .secondaryText,
                                    FlutterFlowTheme.of(context).accent1,
                                  ),
                                  size: 23.0,
                                ),
                                Padding(
                                  padding: EdgeInsetsDirectional.fromSTEB(
                                      0.0, 5.0, 0.0, 0.0),
                                  child: Text(
                                    FFLocalizations.of(context).getText(
                                      'g4lsks1n' /* Задания */,
                                    ),
                                    style: FlutterFlowTheme.of(context)
                                        .bodyLarge
                                        .override(
                                          fontFamily: 'Ubuntu',
                                          color: valueOrDefault<Color>(
                                            _model.number == 1
                                                ? Colors.white
                                                : FlutterFlowTheme.of(context)
                                                    .secondaryText,
                                            FlutterFlowTheme.of(context)
                                                .accent1,
                                          ),
                                          fontSize: 10.0,
                                          letterSpacing: 0.0,
                                          fontWeight: FontWeight.w500,
                                        ),
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ),
                      ),
                    ),
                    Expanded(
                      child: AnimatedContainer(
                        duration: Duration(milliseconds: 200),
                        curve: Curves.easeInOut,
                        decoration: BoxDecoration(
                          color: valueOrDefault<Color>(
                            _model.number == 2
                                ? Color(0x1FFFFFFF)
                                : Color(0x00FFFFFF),
                            Color(0x00FFFFFF),
                          ),
                          borderRadius: BorderRadius.circular(12.0),
                        ),
                        child: Padding(
                          padding: EdgeInsets.all(6.0),
                          child: InkWell(
                            splashColor: Colors.transparent,
                            focusColor: Colors.transparent,
                            hoverColor: Colors.transparent,
                            highlightColor: Colors.transparent,
                            onTap: () async {
                              _model.number = 2;
                              safeSetState(() {});
                            },
                            child: Column(
                              mainAxisSize: MainAxisSize.min,
                              mainAxisAlignment: MainAxisAlignment.center,
                              children: [
                                Icon(
                                  Icons.favorite_rounded,
                                  color: valueOrDefault<Color>(
                                    _model.number == 2
                                        ? Colors.white
                                        : FlutterFlowTheme.of(context)
                                            .secondaryText,
                                    Color(0x34FFFFFF),
                                  ),
                                  size: 23.0,
                                ),
                                Flexible(
                                  child: Padding(
                                    padding: EdgeInsetsDirectional.fromSTEB(
                                        0.0, 5.0, 0.0, 0.0),
                                    child: Text(
                                      FFLocalizations.of(context).getText(
                                        'wz5p6x2x' /* Подарки */,
                                      ),
                                      textAlign: TextAlign.center,
                                      style: FlutterFlowTheme.of(context)
                                          .bodyLarge
                                          .override(
                                            fontFamily: 'Ubuntu',
                                            color: valueOrDefault<Color>(
                                              _model.number == 2
                                                  ? Colors.white
                                                  : FlutterFlowTheme.of(context)
                                                      .secondaryText,
                                              FlutterFlowTheme.of(context)
                                                  .accent1,
                                            ),
                                            fontSize: 10.0,
                                            letterSpacing: 0.0,
                                            fontWeight: FontWeight.w500,
                                          ),
                                    ),
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ),
                      ),
                    ),
                    SizedBox(
                      height: 20.0,
                      child: VerticalDivider(
                        thickness: 1.0,
                        color: FlutterFlowTheme.of(context).secondaryText,
                      ),
                    ),
                    Flexible(
                      child: Container(
                        width: 42.0,
                        height: 42.0,
                        decoration: BoxDecoration(
                          image: DecorationImage(
                            fit: BoxFit.contain,
                            image: Image.asset(
                              'assets/images/photo_chat.png',
                            ).image,
                          ),
                          shape: BoxShape.circle,
                        ),
                      ),
                    ),
                  ].divide(SizedBox(width: 24.0)),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
