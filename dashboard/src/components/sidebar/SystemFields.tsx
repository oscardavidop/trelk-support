// System Fields Section
interface SystemFieldsProps {
  user: {
    firstName: string;
    lastName?: string;
    username?: string;
  };
}

export function SidebarSystemFields({ user }: SystemFieldsProps) {
  const fields = [
    { label: 'Nombre', value: user.firstName },
    { label: 'Apellido', value: user.lastName },
    { label: 'Username', value: user.username ? `@${user.username}` : null },
  ];

  return (
    <div className="px-4 py-2 space-y-2">
      {fields.map((field) => (
        <div key={field.label} className="flex items-center justify-between">
          <span className="text-xs text-gray-500 dark:text-gray-400">{field.label}</span>
          <span className={`text-xs ${
            field.value 
              ? 'text-gray-700 dark:text-gray-300' 
              : 'text-gray-400 dark:text-gray-500 italic'
          }`}>
            {field.value || 'No establecido'}
          </span>
        </div>
      ))}
    </div>
  );
}
