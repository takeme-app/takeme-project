require 'json'

package = JSON.parse(File.read(File.join(__dir__, '..', 'package.json')))

Pod::Spec.new do |s|
  s.name           = 'ExpoMapboxNavigation'
  s.version        = package['version']
  s.summary        = package['description']
  s.description    = package['description']
  s.license        = package['license']
  s.author         = 'TakeMe'
  s.homepage       = 'https://takeme.app'
  s.platforms      = { :ios => '15.1' }
  s.swift_version  = '5.9'
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'
  # Mapbox Navigation SDK v3 para iOS é distribuído oficialmente via Swift
  # Package Manager. Este pod compila sem a dependência e ativa a implementação
  # real somente quando MapboxNavigationCore/UIKit estiverem linkados via SPM.

  # Compiler flags para alinhar com Expo / RN core.
  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'SWIFT_COMPILATION_MODE' => 'wholemodule'
  }

  s.source_files = 'ExpoMapboxNavigation*.swift', '*.{h,m,swift}'
end
