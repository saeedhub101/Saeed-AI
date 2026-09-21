cmake_minimum_required(VERSION 3.24)
project(Saeed LANGUAGES CXX)
if(NOT WIN32)
  message(FATAL_ERROR "Saeed currently targets Windows.")
endif()

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)

include(FetchContent)

set(WEBVIEW2_VERSION "1.0.3179.45")
FetchContent_Declare(WebView2
  URL "https://www.nuget.org/api/v2/package/Microsoft.Web.WebView2/\${WEBVIEW2_VERSION}")
FetchContent_MakeAvailable(WebView2)

FetchContent_Declare(json
  URL "https://github.com/nlohmann/json/releases/download/v3.11.3/json.tar.xz")
FetchContent_MakeAvailable(json)

set(WEBVIEW2_ROOT "\${webview2_SOURCE_DIR}/build/native")
if(CMAKE_SIZEOF_VOID_P EQUAL 8)
  set(WEBVIEW2_ARCH "x64")
else()
  set(WEBVIEW2_ARCH "x86")
endif()

add_executable(Saeed WIN32 src/main.cpp)
target_include_directories(Saeed PRIVATE "\${WEBVIEW2_ROOT}/include")
target_link_libraries(Saeed PRIVATE
  "\${WEBVIEW2_ROOT}/\${WEBVIEW2_ARCH}/WebView2Loader.dll.lib"
  nlohmann_json::nlohmann_json
  user32 gdi32 shcore ole32 oleaut32 version winhttp crypt32
)
target_compile_definitions(Saeed PRIVATE UNICODE _UNICODE NOMINMAX WIN32_LEAN_AND_MEAN)
target_compile_options(Saeed PRIVATE /W4 /EHsc)

add_custom_command(TARGET Saeed POST_BUILD
  COMMAND \${CMAKE_COMMAND} -E copy_if_different
    "\${WEBVIEW2_ROOT}/\${WEBVIEW2_ARCH}/WebView2Loader.dll"
    "$<TARGET_FILE_DIR:Saeed>/WebView2Loader.dll")
add_custom_command(TARGET Saeed POST_BUILD
  COMMAND \${CMAKE_COMMAND} -E copy_directory
    "\${CMAKE_SOURCE_DIR}/assets"
    "$<TARGET_FILE_DIR:Saeed>/assets")
