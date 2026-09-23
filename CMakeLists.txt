cmake_minimum_required(VERSION 3.24)
project(Saeed LANGUAGES CXX)
cmake_policy(SET CMP0091 NEW)
set(CMAKE_MSVC_RUNTIME_LIBRARY "MultiThreaded$<$<CONFIG:Debug>:Debug>")
if(NOT WIN32)
  message(FATAL_ERROR "Saeed currently targets Windows.")
endif()

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)
file(READ "${CMAKE_SOURCE_DIR}/VERSION" SAEED_VERSION)
string(STRIP "${SAEED_VERSION}" SAEED_VERSION)
set(SAEED_BUILD_NUMBER "0" CACHE STRING "Saeed CI build number")
add_compile_definitions(SAEED_VERSION="${SAEED_VERSION}" SAEED_BUILD_NUMBER=${SAEED_BUILD_NUMBER})

include(FetchContent)

FetchContent_Declare(json
  URL "https://github.com/nlohmann/json/releases/download/v3.11.3/json.tar.xz")
FetchContent_MakeAvailable(json)

FetchContent_Declare(cgltf
  URL "https://github.com/jkuhlmann/cgltf/archive/refs/tags/v1.14.tar.gz")
FetchContent_MakeAvailable(cgltf)

set(SAEED_ICON_RESOURCE "")
if(EXISTS "${CMAKE_SOURCE_DIR}/src/Saeed.ico")
  set(SAEED_ICON_RESOURCE src/saeed_icon.rc)
endif()

add_executable(Saeed WIN32
  src/main.cpp
  src/dx11_renderer.cpp
  src/dx11_avatar_renderer.cpp
  src/saeed_capabilities.cpp
  src/saeed_task_engine.cpp
  src/saeed_windows_automation.cpp
  src/version.rc
  ${SAEED_ICON_RESOURCE}
)

target_include_directories(Saeed PRIVATE
  "${cgltf_SOURCE_DIR}"
)

target_link_libraries(Saeed PRIVATE
  nlohmann_json::nlohmann_json
  d3d11
  dxgi
  dcomp
  d3dcompiler
  user32 gdi32 shcore ole32 oleaut32 version winhttp crypt32 windowscodecs
  shlwapi shell32 advapi32 comdlg32
)

target_compile_definitions(Saeed PRIVATE UNICODE _UNICODE NOMINMAX WIN32_LEAN_AND_MEAN _CRT_SECURE_NO_WARNINGS)
target_compile_options(Saeed PRIVATE /W4 /EHsc)

add_custom_command(TARGET Saeed POST_BUILD
  COMMAND ${CMAKE_COMMAND} -E make_directory "$<TARGET_FILE_DIR:Saeed>/assets"
  COMMAND ${CMAKE_COMMAND} -E copy_if_different
    "${CMAKE_SOURCE_DIR}/assets/Saeed_AI-3D.glb"
    "$<TARGET_FILE_DIR:Saeed>/assets/saeed.ai.glb")
