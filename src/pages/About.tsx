import React from 'react';
import { Mail, Phone, AlertCircle, MessageSquare, Code } from 'lucide-react';

function About() {
  return (
    <div className="max-w-4xl mx-auto">
      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-800 px-6 py-8 text-white">
          <h1 className="text-2xl md:text-3xl font-bold mb-2">About the Developer</h1>
          <p className="text-blue-100">NCSC 7 ECA Information Management System</p>
        </div>

        {/* Developer Info */}
        <div className="p-6 md:p-8 border-b">
          <div className="flex flex-col md:flex-row gap-6 items-start">
            <div className="w-32 h-32 rounded-full overflow-hidden bg-gray-100 flex-shrink-0 mx-auto md:mx-0">
              {/* Placeholder for developer photo - replace with actual photo URL if available */}
              <div className="w-full h-full flex items-center justify-center bg-blue-50 text-blue-300">
                <span className="text-4xl font-bold">RG</span>
              </div>
            </div>
            
            <div className="flex-1">
              <h2 className="text-xl font-bold text-gray-800 mb-2">Ralph Jiene D. Gregorio</h2>
              <p className="text-blue-700 font-medium mb-4">Project Development Officer III</p>
              <p className="text-gray-600 mb-4">
                NCSC Regional Office VII - Central Visayas
              </p>
              
              <div className="flex flex-col gap-2">
                <div className="flex items-center">
                  <Mail className="h-5 w-5 text-blue-600 mr-2" />
                  <a href="mailto:rjdgregorio@ncsc.gov.ph" className="text-blue-600 hover:underline">
                    rjdgregorio@ncsc.gov.ph
                  </a>
                </div>
                <div className="flex items-center">
                  <Phone className="h-5 w-5 text-blue-600 mr-2" />
                  <a href="tel:+639998132101" className="text-blue-600 hover:underline">
                    0999-813-2101
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* System Features */}
        <div className="p-6 md:p-8 border-b">
          <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center">
            <Code className="h-5 w-5 text-blue-600 mr-2" />
            System Features
          </h3>
          
          <div className="grid md:grid-cols-2 gap-4">
            <div className="bg-blue-50 p-4 rounded-lg">
              <h4 className="font-medium text-blue-800 mb-2">Citizen Registration</h4>
              <p className="text-sm text-gray-600">
                Comprehensive form for registering citizens with validation and duplicate checking.
              </p>
            </div>
            
            <div className="bg-blue-50 p-4 rounded-lg">
              <h4 className="font-medium text-blue-800 mb-2">Records Management</h4>
              <p className="text-sm text-gray-600">
                Search, filter, and manage citizen records with advanced filtering capabilities.
              </p>
            </div>
            
            <div className="bg-blue-50 p-4 rounded-lg">
              <h4 className="font-medium text-blue-800 mb-2">Stakeholder Directory</h4>
              <p className="text-sm text-gray-600">
                Maintain a directory of stakeholders and partners for easy reference.
              </p>
            </div>
            
            <div className="bg-blue-50 p-4 rounded-lg">
              <h4 className="font-medium text-blue-800 mb-2">Duplicate Detection</h4>
              <p className="text-sm text-gray-600">
                Automatic detection of potential duplicate records to maintain data integrity.
              </p>
            </div>
            
            <div className="bg-blue-50 p-4 rounded-lg">
              <h4 className="font-medium text-blue-800 mb-2">User Management</h4>
              <p className="text-sm text-gray-600">
                Role-based access control for system administrators.
              </p>
            </div>
            
            <div className="bg-blue-50 p-4 rounded-lg">
              <h4 className="font-medium text-blue-800 mb-2">Audit Trail</h4>
              <p className="text-sm text-gray-600">
                Comprehensive logging of all system activities for accountability.
              </p>
            </div>
          </div>
        </div>

        {/* Bug Reports & Suggestions */}
        <div className="p-6 md:p-8">
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center">
                <AlertCircle className="h-5 w-5 text-red-600 mr-2" />
                Bug Reports
              </h3>
              
              <div className="bg-red-50 p-4 rounded-lg">
                <p className="text-sm text-gray-700 mb-3">
                  Found a bug or issue with the system? Please report it with the following details:
                </p>
                <ul className="text-sm text-gray-600 list-disc pl-5 mb-3">
                  <li>Description of the issue</li>
                  <li>Steps to reproduce</li>
                  <li>Expected vs. actual behavior</li>
                  <li>Screenshots (if applicable)</li>
                </ul>
                <p className="text-sm font-medium">
                  Contact via email: 
                  <a href="mailto:rjdgregorio@ncsc.gov.ph?subject=Bug Report: ECA IMS" 
                     className="text-red-700 hover:underline ml-1">
                    rjdgregorio@ncsc.gov.ph
                  </a>
                </p>
              </div>
            </div>
            
            <div>
              <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center">
                <MessageSquare className="h-5 w-5 text-green-600 mr-2" />
                Suggestions
              </h3>
              
              <div className="bg-green-50 p-4 rounded-lg">
                <p className="text-sm text-gray-700 mb-3">
                  Have ideas for improving the system? Your feedback is valuable! Please include:
                </p>
                <ul className="text-sm text-gray-600 list-disc pl-5 mb-3">
                  <li>Feature suggestion details</li>
                  <li>How it would improve your workflow</li>
                  <li>Any reference examples (if applicable)</li>
                </ul>
                <p className="text-sm font-medium">
                  Contact via email: 
                  <a href="mailto:rjdgregorio@ncsc.gov.ph?subject=Suggestion: ECA IMS" 
                     className="text-green-700 hover:underline ml-1">
                    rjdgregorio@ncsc.gov.ph
                  </a>
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      <div className="text-center mt-8 text-sm text-gray-500">
        <p>© {new Date().getFullYear()} NCSC Regional Office VII - Central Visayas</p>
        <p className="mt-1">ECA Information Management System v1.0</p>
      </div>
    </div>
  );
}

export default About;
