import { ADDRESS, CIN, COMPANY_NAME, EMAILS, GSTIN, PHONE } from '../constants/companyInfo';

const ContactInfo = ({ title = 'Contact Us', intro }) => {
  return (
    <section>
      <h2 className="text-2xl font-semibold text-gray-900 mb-4">{title}</h2>
      {intro && <p className="text-gray-700 leading-relaxed mb-2">{intro}</p>}
      <div className="bg-gray-50 p-4 sm:p-5 rounded-lg space-y-2 text-sm sm:text-base break-words [overflow-wrap:anywhere]">
        <p className="text-gray-700">
          <strong>Email:</strong>{' '}
          {EMAILS.map((email, i) => (
            <span key={email} className="inline-block mr-2">
              {i > 0 && <span className="mr-2">,</span>}
              <a href={`mailto:${email}`} className="text-amber-700 hover:underline break-words [overflow-wrap:anywhere]">
                {email}
              </a>
            </span>
          ))}
        </p>
        {PHONE && (
          <p className="text-gray-700">
            <strong>Phone:</strong>{' '}
            <a href={`tel:${PHONE.replace(/\s/g, '')}`} className="text-amber-700 hover:underline break-words">
              {PHONE}
            </a>
          </p>
        )}
        <p className="text-gray-700">
          <strong>Company Name:</strong> {COMPANY_NAME}
        </p>
        <p className="text-gray-700">
          <strong>GSTIN:</strong> {GSTIN}
        </p>
        <p className="text-gray-700">
          <strong>CIN:</strong> {CIN}
        </p>
        <p className="text-gray-700">
          <strong>Address:</strong> {ADDRESS}
        </p>
      </div>
    </section>
  );
};

export default ContactInfo;
