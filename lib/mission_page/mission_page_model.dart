import '/components/nav_bar_widget.dart';
import '/flutter_flow/flutter_flow_util.dart';
import 'mission_page_widget.dart' show MissionPageWidget;
import 'package:flutter/material.dart';

class MissionPageModel extends FlutterFlowModel<MissionPageWidget> {
  ///  State fields for stateful widgets in this page.

  // Model for NavBar component.
  late NavBarModel navBarModel;

  @override
  void initState(BuildContext context) {
    navBarModel = createModel(context, () => NavBarModel());
  }

  @override
  void dispose() {
    navBarModel.dispose();
  }
}
