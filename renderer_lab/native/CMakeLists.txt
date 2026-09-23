cmake_minimum_required(VERSION 3.25)
project(SaeedRendererLabNative LANGUAGES C CXX)
set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_MSVC_RUNTIME_LIBRARY "MultiThreaded$<$<CONFIG:Debug>:Debug>")

include(FetchContent)
FetchContent_Declare(cgltf URL https://github.com/jkuhlmann/cgltf/archive/refs/tags/v1.14.tar.gz)
FetchContent_MakeAvailable(cgltf)

if(NOT DEFINED BGFX_CMAKE_ROOT OR NOT DEFINED FILAMENT_ROOT)
  message(FATAL_ERROR "BGFX_CMAKE_ROOT and FILAMENT_ROOT are required")
endif()

# Keep bgfx shader tooling out of the combined graph. Its generic targets
# (glslang, spirv-opt, etc.) collide with Filament's bundled copies.
# CI compiles bgfx shaders in a separate bgfx-only configure.
set(BGFX_BUILD_TOOLS OFF CACHE BOOL "" FORCE)
set(BGFX_BUILD_TOOLS_SHADER OFF CACHE BOOL "" FORCE)
set(BGFX_BUILD_TOOLS_TEXTURE OFF CACHE BOOL "" FORCE)
set(BGFX_BUILD_TOOLS_GEOMETRY OFF CACHE BOOL "" FORCE)
set(BGFX_BUILD_EXAMPLES OFF CACHE BOOL "" FORCE)
add_subdirectory("${BGFX_CMAKE_ROOT}" "${CMAKE_BINARY_DIR}/bgfx-build" EXCLUDE_FROM_ALL)

set(FILAMENT_BUILD_FILAMAT OFF CACHE BOOL "" FORCE)
set(FILAMENT_ENABLE_MATDBG OFF CACHE BOOL "" FORCE)
set(FILAMENT_ENABLE_SAMPLES OFF CACHE BOOL "" FORCE)
set(FILAMENT_SUPPORTS_OPENGL ON CACHE BOOL "" FORCE)
set(FILAMENT_SUPPORTS_VULKAN OFF CACHE BOOL "" FORCE)
set(FILAMENT_BUILD_TESTS OFF CACHE BOOL "" FORCE)
set(FILAMENT_BUILD_BENCHMARKS OFF CACHE BOOL "" FORCE)
add_subdirectory("${FILAMENT_ROOT}" "${CMAKE_BINARY_DIR}/filament-build" EXCLUDE_FROM_ALL)

add_executable(saeed_renderer_lab_native WIN32
  main.cpp
  d3d11_window.cpp
  opengl_window.cpp
  filament_window.cpp
  bgfx_window.cpp
)

target_include_directories(saeed_renderer_lab_native PRIVATE
  "${cgltf_SOURCE_DIR}"
  "${BGFX_CMAKE_ROOT}/bgfx/include"
  "${BGFX_CMAKE_ROOT}/bx/include"
  "${BGFX_CMAKE_ROOT}/bimg/include"
)

target_link_libraries(saeed_renderer_lab_native PRIVATE
  d3d11 d3dcompiler dxgi opengl32
  bgfx
  filament
  backend
  utils
  gltfio
)

target_compile_definitions(saeed_renderer_lab_native PRIVATE
  UNICODE _UNICODE NOMINMAX SAEED_RENDERER_LAB_REAL_BACKENDS=1
)
