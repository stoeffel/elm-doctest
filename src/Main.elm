port module Main exposing (..)

import DocTest
import String
import Html.App
import Html exposing (div)

main : Program Never
main =
  Html.App.program
    { init = ({ specs = [] }, Cmd.none)
    , update = update
    , subscriptions = subscriptions
    , view = always <| div [] []
    }

type Msg
  = InputSourceCode String
  | NewResult TestResult

update : Msg -> Model -> (Model, Cmd Msg)
update msg model =
  case msg of
    InputSourceCode source ->
      let 
        specs = DocTest.collectSpecs source
        out =
          { src = DocTest.createTempModule source specs
          , runner = DocTest.evaluationScript
          }
      in ({ specs = specs }, evaluate out)

    NewResult result ->
      let
        createReport specs { filename, stdout } =
          if List.isEmpty specs || String.isEmpty stdout
          then DocTest.Report "" False
          else DocTest.createReportFromOutput filename specs stdout
      in (model, report <| createReport model.specs result)

-- data models
type alias TestResult = { stdout : String , filename : String }
type alias Model =
  { specs : List DocTest.Spec
  }

{--
  data flow
  1. @js: read elm source code
  2. @js: send it to the srccode port
  3. @elm: receive InputSourceCode message with sourcecode
  4. @elm: extract specs and create eval script
  5. @elm: send eval script back to js via evaluate port
  6. @js: feed eval script into elm-repl and get stdout
  7. @js: send stdout back to elm via result port
  8. @elm: parse stdout and send formatted report string into js
  9. @elm: dump report and exit
--}
-- input ports
port srccode : (String -> msg) -> Sub msg
port result : (TestResult -> msg) -> Sub msg

subscriptions : Model -> Sub Msg
subscriptions _ =
  Sub.batch
    [ srccode InputSourceCode
    , result NewResult
    ]

-- output ports
port evaluate : { src: String, runner: String } -> Cmd msg
port report : DocTest.Report -> Cmd msg

